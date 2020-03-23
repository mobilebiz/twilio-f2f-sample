# はじめに

みなさん、こんにちは。
KDDIウェブコミュニケーションズのTwilio事業部エバンジェリストの高橋です。

今回は、Twilio CLIを使ったサーバーレス環境の構築の応用編①と題して、Function内から別のFunctionを呼び出す方法について説明します。

Twilio CLIについては、以下の記事も御覧ください。

- [Twilio CLI（セットアップ編）](https://qiita.com/mobilebiz/items/456ce8b455f6aa84cc1e)
- [Twilio CLI（API操作編）](https://qiita.com/mobilebiz/private/0c687a1cd66772885d6e)
- [Twilio CLI（サーバーレス開発編）](https://qiita.com/mobilebiz/items/fb4439bf162098e345ae)

# Functionから別のFunctionを呼び出す

一つのFunctionにすべての機能を実装することもできなくはないですが、可読性が悪くなったり、メンテナンスがしにくくなることを考えると、どうしても複数のFunctionに処理を分割して管理したくなります。
そこで今回は、Functionから別のFunctionを呼び出すベストプラクティスについて解説します。

## ケース1. PublicなFunctionを呼び出す

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

## ケース2. ProtectedなFunctionを呼び出す

ケース１では、呼び出し先のFunctionに関しては、URLがわかってしまえば単独で呼び出しが可能です。実運用環境では、呼び出し先を直接呼び出されると予期しない動作をする可能性もありますし、そもそもセキュリティ的にもあまり勧められません。
そこで、SignatureチェックされるFunction（ProtectedなFunction）を呼び出す方法も説明します。

ケース2のサンプルコードは、たとえば以下のようになります。3行目のtokenは、ご自分のTwilioアカウントに紐づく`AUTH TOKEN`を指定してください。

🔻呼び出し元のFunction（functions/main2.js）

```javascript
const rp = require('request-promise');
exports.handler = async function(context, event, callback) {
  const token = 'xxxxxxxxxxxxxxxxxxxxxxxxx';  // Your Twilio AuthToken
  const url = `https://${context.DOMAIN_NAME}/subFunction2`;
  const params = {
    hoge: 'hoge'
  };
  const signature = getSignature(url, params, token);
  const options = {
    method: 'POST',
    uri: url,
    form: params,
    headers: {
      'X-Twilio-Signature': signature 
    }
  }
  await rp(options)
  .then(res => {
    console.log(`res: ${res}`);
    callback(null, 'main2 done.');
  })
  .catch(err => {
    // callback(err); // これだと、main2自体がエラーで終了する
    callback(null, err.message);  // エラーにはせず、エラーメッセージだけを返す
  });
};

const getSignature = (url, params, token) => {
  const crypto = require('crypto');

  // パラメータを並び替えて、URLに連結した文字列を生成
  if (params !== null) {
    Object.keys(params).sort().forEach(key => {
      url = url + key + params[key];
    });
  }

  // X-Twilio-Signatureの生成
  const signature = crypto.createHmac('sha1', token).update(Buffer.from(url, 'utf-8')).digest('Base64');

  console.log(signature);
  return signature;
};
```

🔻呼び出し先のFunction（functions/subFunction2.protected.js）

```javascript
exports.handler = async function(context, event, callback) {
  console.log('subFunction2 start.');
  await sleep(1000);
  console.log('subFunction2 end.');
  callback (null, 'subFunction2 Done.');  // 正常終了
  // callback (new Error('Fake error.'));    // 擬似的にエラーを発生
};

const sleep = (msec) => new Promise(resolve => setTimeout(resolve, msec));
```

呼び出し先のコード自体はケース1と同じですが、ファイル名に、`.protected`が付与されている点に注意してください。このように、Function名に`.protected`が含まれる場合、このFunctionはSignatureチェックを受けます。
そのため、呼び出し時のヘッダーに、URLとパラメータをもとに`X-Twilio-Signature`を計算して付与しています。この値が不一致の場合、`ERROR 403`（Signature不一致）が表示されて呼び出しは失敗します。

## ケース3. プライベートなAssetsを利用して、コードを外部から見えないようにする

ケース2と同じように、プライベートなAssetsを使って呼び出し先のFunctionを外部からは直接実行できないようにする方法を説明します。

ケース3のサンプルコードはたとえば以下のようになります。このケースでは、呼び出し先のFunctionを、functionsディレクトリではなく、assetsディレクトリ内に作成するところがポイントです。

🔻呼び出し元のFunction（functions/main3.js）

```javascript
exports.handler = async function(context, event, callback) {
  const assets = Runtime.getAssets();
  const subFunctionAsset = assets['/subFunction3.js'];
  const subFunctionPath = subFunctionAsset.path;
  const subFunction = require(subFunctionPath);
  await subFunction()
  .then(result => {
    console.log(`result: ${result}`);
    callback(null, result);
  })
  .catch(err => {
    console.log(err);
    // callback(err); // これだと、main3自体がエラーで終了する
    callback(null, err.message);  // エラーにはせず、エラーメッセージだけを返す
  });
};
```

🔻呼び出し先のFunction（assets/subFunction3.private.js）

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

このケースはコード自体をAssetsに格納して、それをコード上に読み込む方法をとっています。Assetsに格納したコードはプライベートモードで保存する（ファイル名の拡張子の前に、`.private`をつける）ため外部からは見えません。ただし、プライベートモードで格納されているコードであっても、読み込む時は.privateは不要である点に気をつけてください。また、Twilioの仕様上プライベートなAssetsは10個しか保存できません。

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
