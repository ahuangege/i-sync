
export class ISync<T extends { [file: string]: { [method: string]: any } }> {

    private handler: T;
    private dataDic: { [file: string]: { [method: string]: { [uid: string]: any[] } } } = {};
    private syncCount: number;
    private logger: { error: (reason: any) => void };
    sync: T;
    private count = 0;

    constructor(opts: I_initOptions<T>) {
        this.handler = opts.handler;
        this.syncCount = opts.syncCount || +Infinity;
        this.logger = opts.logger || console;

        let interval = opts.syncInterval || 5 * 60 * 1000;
        setInterval(this.save.bind(this), interval);


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

    async saveUid(uid: number | string) {
        for (let file in this.dataDic) {
            for (let method in this.dataDic[file]) {
                let data = this.dataDic[file][method][uid];
                if (!data) {
                    continue;
                }
                delete this.dataDic[file][method][uid];

                await this.saveFunc(file, method, data)
                    .catch((reason) => {
                        this.logger.error(reason);
                    });
            }
        }
    }


    saveAll() {
        this.save();
    }

    isDone() {
        if (this.count > 0) {
            return false;
        }
        for (let file in this.dataDic) {
            for (let method in this.dataDic[file]) {
                return false;
            }
        }
        return true;
    }

    private save() {
        let dataDic = this.dataDic;
        this.dataDic = {};

        for (let file in this.dataDic) {
            for (let method in this.dataDic[file]) {
                let obj = this.dataDic[file][method];
                for (let x in obj) {

                }
            }
        }

    }

    private async saveFunc(file: string, method: string, args: any[]) {
        await this.handler[file][method](...args);
    }

}

interface I_initOptions<T> {
    /** 同步函数 */
    handler: T,
    /** 同步间隔 ms，默认5分钟 */
    syncInterval?: number,
    /** 单次同步数量（注：为防止瞬间同步量过大。） */
    syncCount?: number,

    logger?: {
        error: (reason: any) => void
    }
}


class Countdown {
    private count: number;
    private callback: Function;
    constructor(count: number, callback: Function) {
        this.count = count;
        this.callback = callback;
        if (count <= 0) {
            process.nextTick(this.callback);
        }
    }

    down() {
        this.count--;
        if (this.count === 0) {
            process.nextTick(this.callback);
        }
    }
}

function createCountdown(count: number, callback: Function): Countdown {
    return new Countdown(count, callback);
};