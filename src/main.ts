export interface IframeChild {
    elementRef: HTMLIFrameElement;
    name: string;
}

export interface IframeFather {
    uri: string;
    name: string;
}

export interface MessageEstructure {
    code: MESSAGE_CODES | string;
    message: any;
}

export interface LocalData {
    uri: string;
    data: any;
}

export interface MessageCallback {
    code: MESSAGE_CODES | string;
    callback: (event: any) => void;
}

export enum MESSAGE_CODES {
    CUSTOM = 'CUSTOM',
    CHILD_GLOBAL_DATA = 'CHILD_GLOBAL_DATA',
    FATHER_GLOBAL_DATA = 'FATHER_GLOBAL_DATA',
}

export class IframeLight {
    private static instance: IframeLight;
    private globalObj: any;
    private onMessageCustomCallback: (event?: any) => void;
    private onMessageCallbacks: MessageCallback[] = [];
    private _debug: boolean = false;
    private _fathers: IframeFather[] = [];
    private _children: IframeChild[] = [];
    private _localData: LocalData = {
        uri: window.location.href.substring(0, window.location.href.lastIndexOf('/')),
        data: {}
    };
    private _globalData: LocalData[] = [this._localData];

    public get fathers() {
        return this._fathers;
    }
    public set fathers(fathers: IframeFather[]) {
        this._fathers = fathers;
    }
    public get children() {
        return this._children;
    }
    public set children(children: IframeChild[]) {
        this._children = children;
    }

    constructor() {
        this.initEvents();
        console.info(`MicrofrontLight ready! - [${this._localData.uri}]`);
    }

    // Events

    private eventDebugMode() {
        if (this._debug) {
            console.log(`MicrofrontLight event - [${this._localData.uri}]`, event);
        }
    }

    private eventChildGlobalData(event, code) {
        this.updateGlobalDataWithIncomingGlobalData(event.data.message, code);
        if (this._fathers.length) {
            this.sendGlobalDataToAllFathers();
        } else if (!this.fathers.length && this._children.length){
            this.sendGlobalDataToAllChildren();
        }
    }

    private eventFatherGlobalData(event, code) {
        this.updateGlobalDataWithIncomingGlobalData(event.data.message, code);
        this.sendGlobalDataToAllChildren();
    }

    private eventCheckOnMessageCallback(event, code) {
        const messageCallback = this.findMessageCallbackByCode(code);
        if (messageCallback) {
            messageCallback.callback(event);
        }
    }

    private initEvents() {
        this.eventDebugMode();
        window.onmessage = (event: any) => {
            const code = event.data?.code || MESSAGE_CODES.CUSTOM;
            if (this.hasCorrectOrigin(event)) {
                if (code === MESSAGE_CODES.CUSTOM) {
                    this.onMessageCustomCallback(event);
                } else if (code === MESSAGE_CODES.CHILD_GLOBAL_DATA) {
                    this.eventChildGlobalData(event, code);
                } else if (code === MESSAGE_CODES.FATHER_GLOBAL_DATA) {
                    this.eventFatherGlobalData(event, code);
                }
                this.eventCheckOnMessageCallback(event, code);
            }
        }
    }

    // Tools & Utils

    private hasCorrectOrigin(event: any): boolean {
        return (
            !!(this.findFatherByOrigin(event.origin)) ||
            !!(this.findChildByOrigin(event.origin))
        );
    }

    private findFatherByOrigin(origin: string): IframeFather | undefined {
        return this.fathers.find((father, index) => father?.uri === origin);
    }

    private findFatherByName(name: string): IframeFather | undefined {
        return this.fathers.find((father, index) => father?.name === name);
    }

    private findChildByOrigin(origin: string): IframeChild | undefined {
        return this.children.find((child, index) => (child as any).elementRef?.nativeElement?.getAttribute('src') === origin);
    }

    private findChildByName(name: string): IframeChild | undefined {
        return this.children.find((child, index) => child?.name === name);
    }
    
    private findMessageCallbackByCode(code: string): MessageCallback | undefined {
        return this.onMessageCallbacks.find((callback, index) => callback?.code === code);
    }

    private formatMessage(message: any, code?: MESSAGE_CODES | string): MessageEstructure{
        const messageEstructure: MessageEstructure = {
            code: code || MESSAGE_CODES.CUSTOM,
            message
        }
        return messageEstructure;
    }

    // Send data

    private sendGlobalDataToAllFathers() {
        this.fathers.forEach((father) => {
            parent.postMessage(
                this.formatMessage(this._globalData, MESSAGE_CODES.CHILD_GLOBAL_DATA), 
                father.uri
            );
        });
    }

    private sendGlobalDataToAllChildren() {
        this.children.forEach((child) => {
            const src = (child as any)?.elementRef?.nativeElement?.getAttribute('src');
            (child as any).elementRef.nativeElement?.contentWindow?.postMessage(
                this.formatMessage(this._globalData, MESSAGE_CODES.FATHER_GLOBAL_DATA), 
                src
            );
        });
    }

    // Update data

    private updateGlobalDataWithIncomingLocalData(incomingLocalData: LocalData) {
        const sharedDataExist = this._globalData.find((currentChildData) => currentChildData.uri === incomingLocalData.uri);
        if (!sharedDataExist) {
            this._globalData.push(incomingLocalData);
        } else {
            this._globalData = this._globalData.map((currentChildData) => {
                if (currentChildData.uri === incomingLocalData.uri) {
                    return incomingLocalData;
                } else {
                    return currentChildData;
                }
            });
        }
    }

    private updateGlobalDataWithOwnLocalData() {
        this.updateGlobalDataWithIncomingLocalData(this._localData);
    }

    private updateGlobalDataWithIncomingGlobalData(incomingGlobalData: LocalData[], code: MESSAGE_CODES) {
        if (code === MESSAGE_CODES.CHILD_GLOBAL_DATA) { // Update or add new data from CHILD global data
            incomingGlobalData.map((incomingData: LocalData) => {
                this.updateGlobalDataWithIncomingLocalData(incomingData);
            })
        } else if (code === MESSAGE_CODES.FATHER_GLOBAL_DATA) { // Overwrite global data with FATHER global data
            this._globalData = incomingGlobalData;
        }
        this.updateGlobalDataWithOwnLocalData(); // Update global data with own local data
    }

    private localDataChangeLogic() {
        this.updateGlobalDataWithOwnLocalData();
        if (this._fathers.length) {
            this.sendGlobalDataToAllFathers();
        } else if (this._children.length){
            this.sendGlobalDataToAllChildren();
        }
    }

    // Config

    public static init(globalObj: any, debug?: boolean): IframeLight {
        if (!IframeLight.instance) {
            IframeLight.instance = new IframeLight();
            if (debug) {
                IframeLight.instance._debug = debug;
                console.warn('MicrofrontLight is in debug mode');
            }
        }
        IframeLight.instance.globalObj = globalObj;
        return IframeLight.instance;
    }

    public setOnMessageCustomCallback(callback: (event?: any) => void) {
        this.onMessageCustomCallback = callback.bind(this.globalObj);
    }

    public addOnMessageCallback(code: string, callback: (event?: any) => void) {
        const messageCallback = this.findMessageCallbackByCode(code)
        if (!messageCallback) {
            this.onMessageCallbacks.push({
                code,
                callback: callback.bind(this.globalObj)
            });
        }
    }

    public removeOnMessageCallback(code: string) {
        this.onMessageCallbacks = this.onMessageCallbacks.filter((callback) => callback.code !== code);
    }

    public addFather(uri: string, name: string): void {
        const father: IframeFather = {
            uri,
            name
        }
        this.fathers.push(father);
        // Send data to new father added
        this.updateGlobalDataWithOwnLocalData();
        this.sendGlobalDataToAllFathers();
    }

    public addChild(iframe: HTMLIFrameElement, name: string) {
        const child: IframeChild = {
            elementRef: iframe,
            name
        }
        this.children.push(child);
        // Send data to new child added
        this.updateGlobalDataWithOwnLocalData();
        this.sendGlobalDataToAllChildren();
    }

    // Messaging

    public messageToFatherByName(name: string, message: any, code?: string) {
        const father = this.findFatherByName(name);
        if (father) {
            parent.postMessage(this.formatMessage(message, code), father.uri);
        }
    }   

    public messageToChildByName(name: string, message: any, code?: string) {
        const child = this.findChildByName(name);
        if (child) {
            const src = (child as any)?.elementRef?.nativeElement?.getAttribute('src');
            (child as any).elementRef.nativeElement?.contentWindow?.postMessage(this.formatMessage(message, code), src);
        }
    }
    
    public messageToAllFathers(message: any, code?: string) {
        this.fathers.forEach((father) => {
            parent.postMessage(this.formatMessage(message, code), father.uri);
        });
    }

    public messageToAllChildren(message: any, code?: string) {
        this.children.forEach((child) => {
            const src = (child as any)?.elementRef?.nativeElement?.getAttribute('src');
            (child as any).elementRef.nativeElement?.contentWindow?.postMessage(this.formatMessage(message, code), src);
        });
    }

    // Data

    public setLocalData(name: string, data: any) {
        this._localData.data[name] = data;
        this.localDataChangeLogic();
    }

    public removeLocalData(name?: string) {
        if (typeof name === 'string') {
            delete this._localData.data[name];
        } else {
            this._localData.data = {};
        }
        this.localDataChangeLogic();
    }

    public getLocalData(): LocalData {
        return this._localData;
    }

    public getGlobalData(): LocalData[] {
        return this._globalData;
    }
}