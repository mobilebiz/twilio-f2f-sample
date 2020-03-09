exports.handler = async function(context, event, callback) {
  console.log('subFunction1 start.');
  await sleep(1000);
  console.log('subFunction1 end.');
  callback (null, 'subFunction1 Done.');  // 正常終了
  // callback (new Error('Fake error.'));    // 擬似的にエラーを発生
};

const sleep = (msec) => new Promise(resolve => setTimeout(resolve, msec));
