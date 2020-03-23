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
