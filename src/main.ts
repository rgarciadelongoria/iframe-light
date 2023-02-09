export interface IframeChild {
    elementRef: HTMLIFrameElement;
    name: string;
}

export interface IframeFather {
    uri: string;
    name: string;
}

export interface MessageEstructure {
    code: MESSAGE_CODES;
    message: any;
}

export interface LocalData {
    uri: string;
    data: any;
}

export enum MESSAGE_CODES {
    CUSTOM = 'CUSTOM',
    CHILD_GLOBAL_DATA = 'CHILD_GLOBAL_DATA',
    FATHER_GLOBAL_DATA = 'FATHER_GLOBAL_DATA',
}

export class IframeLight {
    private static instance: IframeLight;
    private onMessageCallback: (event: any) => void;
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

    private initEvents() {
        // TODO - extract to function to manage events
        window.onmessage = (event: any) => {
            if (this._debug) {
                console.log(`MicrofrontLight event - [${this._localData.uri}]`, event);
            }
            const code = event.data?.code || MESSAGE_CODES.CUSTOM;
            if (this.hasCorrectOrigin(event)) {
                if (code === MESSAGE_CODES.CUSTOM) {
                    this.onMessageCallback(event);
                } else if (code === MESSAGE_CODES.CHILD_GLOBAL_DATA) {
                    // TODO - extract to a function for better readability
                    this.updateGlobalDataWithIncomingGlobalData(event.data.message, code);
                    if (this._fathers.length) {
                        this.sendGlobalDataToAllFathers();
                    } else if (!this.fathers.length && this._children.length){
                        this.sendGlobalDataToAllChildren();
                    }
                } else if (code === MESSAGE_CODES.FATHER_GLOBAL_DATA) {
                    // TODO - extract to a function for better readability
                    this.updateGlobalDataWithIncomingGlobalData(event.data.message, code);
                    this.sendGlobalDataToAllChildren();
                }
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

    private formatMessage(message: any, code?: MESSAGE_CODES): MessageEstructure{
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

    // Config

    public static init(debug?: boolean): IframeLight {
        if (!IframeLight.instance) {
            IframeLight.instance = new IframeLight();
            if (debug) {
                IframeLight.instance._debug = debug;
                console.warn('MicrofrontLight is in debug mode');
            }
        }
        return IframeLight.instance;
    }

    public setOnMessageCallback(callback: (event: any) => void) {
        this.onMessageCallback = callback;
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

    public messageToFatherByName(name: string, message: any) {
        const father = this.findFatherByName(name);
        if (father) {
            parent.postMessage(this.formatMessage(message), father.uri);
        }
    }   

    public messageToChildByName(name: string, message: any) {
        const child = this.findChildByName(name);
        if (child) {
            const src = (child as any)?.elementRef?.nativeElement?.getAttribute('src');
            (child as any).elementRef.nativeElement?.contentWindow?.postMessage(this.formatMessage(message), src);
        }
    }
    
    public messageToAllFathers(message: any) {
        this.fathers.forEach((father) => {
            parent.postMessage(this.formatMessage(message), father.uri);
        });
    }

    public messageToAllChildren(message: any) {
        this.children.forEach((child) => {
            const src = (child as any)?.elementRef?.nativeElement?.getAttribute('src');
            (child as any).elementRef.nativeElement?.contentWindow?.postMessage(this.formatMessage(message), src);
        });
    }

    // Data

    private localDataChangeLogic() {
        this.updateGlobalDataWithOwnLocalData();
        if (this._fathers.length) {
            this.sendGlobalDataToAllFathers();
        } else if (this._children.length){
            this.sendGlobalDataToAllChildren();
        }
    }

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