# はじめに

今回は、Twilio CLIを使ったサーバーレス環境の構築の応用編①と題して、Function内から別のFunctionを呼び出す方法について説明します。

Twilio CLIについては、以下の記事も御覧ください。

- [Twilio CLI（セットアップ編）](https://qiita.com/mobilebiz/items/456ce8b455f6aa84cc1e)
- [Twilio CLI（API操作編）](https://qiita.com/mobilebiz/private/0c687a1cd66772885d6e)
- [Twilio CLI（サーバーレス開発編）](https://qiita.com/mobilebiz/items/fb4439bf162098e345ae)

## セットアップ

```sh
git clone https://github.com/mobilebiz/twilio-f2f-sample.git
cd twilio-f2f-sample.git
npm install
cp .env.sample .env
```

`.env`ファイルをエディタで開き、ご自分の環境に併せてACCOUNT_SIDとAUTH_TOKENを修正します。  
このACCOUNT_SID/AUTH_TOKENには、別のサーバーレスで生成されたAPIキーとシークレットを使ってください。

## Functionから別のFunctionを呼び出す

一つのFunctionにすべての機能を実装することもできなくはないですが、可読性が悪くなったり、メンテナンスがしにくくなることを考えると、どうしても複数のFunctionに処理を分割して管理したくなります。
そこで今回は、Functionから別のFunctionを呼び出すベストプラクティスについて解説します。

### ケース1. PublicなFunctionを呼び出す

Twilio Functionsを使ったことがある方ならご存知かと思いますが、Twilio Functionsを実行するときのセキュリティ対策として、Signatureチェックをするかどうかが選択できます。
詳しくは、[こちらの記事](https://qiita.com/mobilebiz/items/f8a8c795d5187e67166a)に解説があります。
このSignatureチェックをしないFunctionを**Public**なFunctionと呼び、FunctionのURLを知っていれば誰でもアクセスすることが可能です。

Functionから、PublicなFunctionを呼ぶコードは例えば以下のようになります。これらをコードを同じfunctiosディレクトリに格納した状態でデプロイします。

🔻呼び出し元のFunction（functions/main1.js）

```javascript
const rp = require('request-promise');
exports.handler = async function(context, event, callback) {
  await rp(`https://${context.DOMAIN_NAME}/subFunction1`)
  .then(res => {
    console.log(`res: ${res}`);
    callback(null, 'main1 done.');
  })
  .catch(err => {
    // callback(err); // これだと、main2自体がエラーで終了する
    callback(null, err.message);  // エラーにはせず、エラーメッセージだけを返す
  });
};
```

🔻呼び出し先のFunction（functions/subFunction1.js）

```javascript
exports.handler = async function(context, event, callback) {
  console.log('subFunction1 start.');
  await sleep(1000);
  console.log('subFunction1 end.');
  callback (null, 'subFunction1 Done.');  // 正常終了
  // callback (new Error('Fake error.'));    // 擬似的にエラーを発生
};

const sleep = (msec) => new Promise(resolve => setTimeout(resolve, msec));
```

このケースでは、呼び出し先のFunctionがPublicなため、呼び出し元FunctionからはHTTPのGETで呼び出しを行っています（今回は`request-promise`を使っています）。
呼び出し自体は非同期で行われるため、async/awaitによる対策をしています。awaitで呼び出しをしないと、呼び出し先Functionの実行が完了する前に制御が先にすすんでしまうため、思った通りの処理が行われません。今回はこの辺をわかりやすくするため、あえて呼び出し先で１秒間のスリープ処理をいれています。

また、このやり方では、呼び出し元のFunctionが呼ばれたときのObject変数（contextやevent）は、呼び出し先のFunctionに引き継がれるわけではないので気をつけてください。

### ケース2. 呼び出し先のFunctionを外部から見えないようにする

ケース１では、呼び出し先のFunctionに関しては、URLがわかってしまえば単独で呼び出しが可能です。実運用環境では、呼び出し先を直接呼び出されると予期しない動作をする可能性もありますし、そもそもセキュリティ的にもあまり勧められません。
そこで呼び出し先のFunctionを外部からは直接実行できないようにする方法を説明します。

ケース２のサンプルコードはたとえば以下のようになります。このケースでは、呼び出し先のFunctionを、functionsディレクトリではなく、assetsディレクトリ内に作成するところがポイントです。

🔻呼び出し元のFunction（functions/main2.js）

```javascript
exports.handler = async function(context, event, callback) {
  const assets = Runtime.getAssets();
  const subFunctionAsset = assets['/subFunction2.js'];
  const subFunctionPath = subFunctionAsset.path;
  const subFunction = require(subFunctionPath);
  await subFunction()
  .then(result => {
    console.log(`result: ${result}`);
    callback(null, result);
  })
  .catch(err => {
    console.log(err);
    // callback(err); // これだと、main2自体がエラーで終了する
    callback(null, err.message);  // エラーにはせず、エラーメッセージだけを返す
  });
};
```

🔻呼び出し先のFunction（assets/subFunction2.private.js）

```javascript
module.exports = subFunction = () => {
    return new Promise(async (resolve, reject) => {
        console.log('subFunction start.');
        await sleep(1000);
        console.log('subFunction end.');
        resolve('subFunction Done.');    // 正常終了時
        // reject(new Error('Fake error.'));   // 擬似的にエラーを発生
    });
};

const sleep = (msec) => new Promise(resolve => setTimeout(resolve, msec));
```

本来、ProtectedなFunctionにするには、functionsディレクトリ内に、`function名.protected.js`という名前で作成するのですが、このように作ってしまうと、ケース１のやり方で呼び出すと`ERROR 403`（Signature不一致）が出てしまってうまくいきません。
そこで、コード自体をAssetsに格納して、それをコード上に読み込む方法をとります。Assetsに格納したコードはプライベートモードで保存する（ファイル名の拡張子の前に、`.private`をつける）ため外部からは見えません。ただし、プライベートモードで格納されているコードであっても、読み込む時は.privateは不要である点に気をつけてください。

このサンプルコードでは、呼び出し先のFunctionをPromise形式で作成しているため、呼び出し先で何らかのエラーが発生した場合に、エラーとして呼び出し元に通知することができます。
このようにしておくことで、例えば次のコードのように、呼び出し先が複数ある場合などでもネストが少ないシンプルなコーディングができるのでおすすめです。

```javascript
await subFunctionA()
.then(async res => {
  return await subFunctionB();
})
.then(async res => {
  return await subFunctionC();
})
.then(res => {
  callback(null, 'Done.');
})
.catch(err => {
  callback(err);
});
```
