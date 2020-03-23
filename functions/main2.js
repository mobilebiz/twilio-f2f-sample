const rp = require('request-promise');
exports.handler = async function(context, event, callback) {
  const token = context.TWILIO_AUTH_TOKEN;  // Your Twilio AuthToken
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