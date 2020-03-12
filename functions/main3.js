exports.handler = async function(context, event, callback) {
  const assets = Runtime.getAssets();
  const subFunctionAsset = assets['/subFunction2.js'];
  const subFunctionPath = subFunctionAsset.path;
  const subFunction = require(subFunctionPath);
  
  const result1 = await subFunction().catch(err => callback(err));
  console.log(`result1: ${result1}`);
  const result2 = await subFunction().catch(err => callback(err));
  console.log(`result2: ${result2}`);
  const result3 = await subFunction().catch(err => callback(err));
  console.log(`result3: ${result3}`);
  // callback(null, 'Done.');
  
  const func1 = subFunction();
  await func1.then(result => console.log(`result: ${result}`)).catch(err => callback(err));
  const func2 = subFunction();
  await func2.then(result => console.log(`result: ${result}`)).catch(err => callback(err));
  const func3 = subFunction();
  await func3.then(result => console.log(`result: ${result}`)).catch(err => callback(err));
  // callback(null, 'Done.');

  try {
    console.log(`result: ${await subFunction()}`);
    console.log(`result: ${await subFunction()}`);
    console.log(`result: ${await subFunction()}`);
    callback(null, 'Done.');
  } catch (err) {
    callback(err);
  };
};
