exports.handler = async function(context, event, callback) {
  console.log('subFunction2 start.');
  await sleep(1000);
  console.log('subFunction2 end.');
  callback (null, 'subFunction2 Done.');  // 正常終了
  // callback (new Error('Fake error.'));    // 擬似的にエラーを発生
};

const sleep = (msec) => new Promise(resolve => setTimeout(resolve, msec));
