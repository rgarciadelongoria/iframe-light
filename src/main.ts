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
    CHILD_LOCAL_DATA = 'CHILD_LOCAL_DATA',
}

export class IframeLight {
    private static instance: IframeLight;
    private onMessageCallback: (event: any) => void;
    private _fathers: IframeFather[] = [];
    private _children: IframeChild[] = [];
    private _localData: LocalData = {
        uri: window.location.href.substring(0, window.location.href.lastIndexOf('/')),
        data: {}
    };
    private _globalData: LocalData[] = [];

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
        console.warn('MicrofrontLight Ready!');
    }

    private initEvents() {
        window.onmessage = (event: any) => {
            console.log(event);
            const code = event.data?.code || MESSAGE_CODES.CUSTOM;
            if (this.hasCorrectOrigin(event)) {
                if (code === MESSAGE_CODES.CUSTOM) {
                    this.onMessageCallback(event);
                } else if (code === MESSAGE_CODES.CHILD_LOCAL_DATA) {
                    this.updateGlobalDataWithChildLocalData(event.data.message);
                }
            }
        }
    }

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

    private sendLocalDataToAllFathers() {
        this.fathers.forEach((father) => {
            parent.postMessage(this.formatMessage(this._localData, MESSAGE_CODES.CHILD_LOCAL_DATA), father.uri);
        });
    }

    private updateGlobalDataWithChildLocalData(incomingChildData: LocalData) {
        const sharedDataExist = this._globalData.find((currentChildData) => currentChildData.uri === incomingChildData.uri);
        if (!sharedDataExist) {
            this._globalData.push(incomingChildData);
        } else {
            this._globalData = this._globalData.map((currentChildData) => {
                if (currentChildData.uri === incomingChildData.uri) {
                    return incomingChildData;
                } else {
                    return currentChildData;
                }
            });
        }
    }

    public static init() {
        if (!IframeLight.instance) {
            IframeLight.instance = new IframeLight();
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
    }

    public addChild(iframe: HTMLIFrameElement, name: string) {
        const child: IframeChild = {
            elementRef: iframe,
            name
        }
        this.children.push(child);
    }

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

    public setLocalData(name: string, data: any) {
        this._localData.data[name] = data;
        this.sendLocalDataToAllFathers();
    }

    public getLocalData(): LocalData {
        return this._localData;
    }

    public getGlobalData(): LocalData[] {
        return this._globalData;
    }
}