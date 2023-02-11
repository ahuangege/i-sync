
export class SyncUtil<T extends { [file: string]: { [method: string]: any } }> {

    private handler: T;
    private syncCount: number;
    private logger: { error: (reason: any) => void };

    private dataDic: { [file: string]: { [method: string]: { [uid: string]: any[] } } } = {};

    sync: T;

    private isSaving = false;
    private savePromiseArr: Function[] = [];
    private untilAll: boolean = false;

    constructor(opts: I_initOptions<T>) {
        this.handler = opts.handler;
        this.syncCount = opts.syncCount || +Infinity;
        this.logger = opts.logger || console;

        let interval = opts.syncInterval || 5 * 60 * 1000;
        setInterval(() => { this.save(false) }, interval);


        let self = this;
        this.sync = new Proxy({}, {
            get(_fileDic: any, file: string) {
                let methodDic = _fileDic[file];
                if (!methodDic) {
                    methodDic = new Proxy({}, {
                        get(_methodDic: any, method: string) {
                            let func = _methodDic[method];
                            if (!func) {
                                func = self.syncFunc(file, method);
                                _methodDic[method] = func;
                            }
                            return func;
                        }
                    });
                    _fileDic[file] = methodDic;
                }
                return methodDic;
            }
        });
    }

    private syncFunc(file: string, method: string) {
        let self = this;
        let func = function (...args: any[]) {
            let dataDic = self.dataDic;
            if (!dataDic[file]) {
                dataDic[file] = {};
            }
            if (!dataDic[file][method]) {
                dataDic[file][method] = {};
            }
            dataDic[file][method][args[0]] = args;
        }
        return func;
    }

    /**
     * 保存单个uid的单个记录
     */
    async saveFileMethodUid(file: keyof T, method: keyof T[keyof T], uid: number | string) {
        let dataDic = this.dataDic as any;
        if (!dataDic[file]) {
            return;
        }
        if (!dataDic[file][method]) {
            return;
        }
        let data: any[] = dataDic[file][method][uid];
        if (!data) {
            return;
        }
        delete dataDic[file][method][uid];

        await this.saveFunc(file as string, method as string, data)
            .catch((reason) => {
                this.logger.error(reason);
            });
    }

    /**
     * 保存单个uid的所有记录
     */
    async saveUid(uid: number | string) {
        let promisArr: Promise<void>[] = [];
        for (let file in this.dataDic) {
            for (let method in this.dataDic[file]) {
                let data = this.dataDic[file][method][uid];
                if (!data) {
                    continue;
                }
                delete this.dataDic[file][method][uid];

                promisArr.push(this.saveFunc(file, method, data)
                    .catch((reason) => {
                        this.logger.error(reason);
                    })
                );
            }
        }
        await Promise.all(promisArr);
    }

    /**
     * 保存所有（一般在服务器关闭时主动调用）
     */
    async saveAll() {

        this.save(true);

        let promise = new Promise((resolve) => {
            this.savePromiseArr.push(resolve);
        });
        return promise;
    }

    private async save(untilAll: boolean) {
        if (!this.untilAll) {
            this.untilAll = untilAll;
        }
        if (this.isSaving) {
            return;
        }
        this.isSaving = true;

        let dataDic = this.dataDic;
        this.dataDic = {};

        let promisArr: Promise<void>[] = [];
        for (let file in dataDic) {
            for (let method in dataDic[file]) {
                let obj = dataDic[file][method];
                for (let uid in obj) {

                    promisArr.push(this.saveFunc(file, method, obj[uid])
                        .catch((reason) => {
                            this.logger.error(reason);
                        })
                    );

                    if (promisArr.length === this.syncCount) {
                        await Promise.all(promisArr);
                        promisArr = [];
                    }

                }
            }
        }

        await Promise.all(promisArr);
        this.isSaving = false;

        if (this.untilAll && !this.isEmpty(this.dataDic)) {
            this.save(true);
        } else {
            this.untilAll = false;

            for (let one of this.savePromiseArr) {
                process.nextTick(one);
            }
            this.savePromiseArr = [];
        }

    }

    private isEmpty(dataDic: { [file: string]: { [method: string]: { [uid: string]: any[] } } }) {
        for (let file in dataDic) {
            for (let method in dataDic[file]) {
                for (let uid in dataDic[file][method]) {
                    return false;
                }
            }
        }
        return true;
    }

    private async saveFunc(file: string, method: string, args: any[]) {
        await this.handler[file][method](...args);
    }

}

interface I_initOptions<T> {
    /**
     * 同步函数
     */
    handler: T,
    /** 
     * 同步间隔 ms，默认5分钟
     */
    syncInterval?: number,
    /** 
     * 单次同步中的单批数量，默认 +Infinity
     */
    syncCount?: number,
    /** 
     * 异常日志输出
     */
    logger?: {
        error: (reason: any) => void
    }
}
