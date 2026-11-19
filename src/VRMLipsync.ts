import { VRM } from "@pixiv/three-vrm";

export class LipSync {
    private audio: AudioContext;
    private analyser: AnalyserNode;
    private dataArray: Uint8Array<ArrayBuffer>;
    private volume: number = 0;
    public isPlaying: boolean;
    private vrm: VRM | null = null;
    duration: number = 0;
    pausedTime: number = 0;
    private FicialParamVolume: number = 0; // リップシンクの開閉の大きさの値_計算結果
    private currentSource: AudioBufferSourceNode | null = null;
    private queue: Float32Array[] = [];
    private queueDataText: any[] = [];
    private queueEmotion: any[] = [];
    private isProcessingQueue: boolean = false;
    private eventListeners: { [key: string]: (() => void)[] } = {};
    private Value_aa:number = 0;
    private Value_ih:number = 0;
    private Value_ou:number = 0;
    private Value_ee:number = 0;
    private Value_oh:number = 0;
    public FicialParam: any;
    waveform: Float32Array;
    public lipVolume:number = 1.0;

    constructor( Param:any ) {
        this.audio = new AudioContext({
            sampleRate: 24000, // 44100,
            latencyHint: 'interactive'
        });
        this.analyser = this.audio.createAnalyser();
        this.analyser.fftSize = 2048; //4096
        this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        this.isPlaying = false;

        this.FicialParam = Param;
        this.waveform = new Float32Array(this.analyser.frequencyBinCount);
        this.lipVolume = 0.38;
    }

    // イベントリスナーを追加する
    addEventListener(event: string, listener: () => void) {
        if (!this.eventListeners[event]) {
            this.eventListeners[event] = [];
        }
        this.eventListeners[event].push(listener);
    }

    // イベントを発火する
    private emit(event: string) {
        if (this.eventListeners[event]) {
            this.eventListeners[event].forEach(listener => listener());
        }
    }

    async addToQueue( audioData: Float32Array, data:string, duration:number, emotion:any ): Promise<void> {
        this.queue.push(audioData);
        this.queueDataText.push({text:data, duration:duration});
        this.queueEmotion.push(emotion);

        if (!this.isProcessingQueue) {
            this.processQueue();
        }
    }

    async addplay( audioData: Float32Array): Promise<void> {
        await this.playAudio(audioData);
    }

    private async processQueue(): Promise<void> {
        this.isProcessingQueue = true;

        while (this.queue.length > 0) {
            const audioData = this.queue.shift()!;
            // const data = this.queueDataText.shift()!;
            // const emotion = this.queueEmotion.shift()!;

            await this.playAudio(audioData);
        }

        this.isProcessingQueue = false;
    }

    private preprocessAudio(audioData: Float32Array): Float32Array {

        // 正規化（より効率的な方法で実装）
        let maxAmplitude = 0;
        for (let i = 0; i < audioData.length; i++) {
          const absValue = Math.abs(audioData[i]);
          if (absValue > maxAmplitude) {
            maxAmplitude = absValue;
          }
        }

        if (maxAmplitude > 0) {
          const result = new Float32Array(audioData.length);
          for (let i = 0; i < audioData.length; i++) {
            result[i] = audioData[i] / maxAmplitude;
          }
          return result;
        }
        return audioData;
      }

    // サーバーから受け取った音声データを再生する
    private async playAudio(audioData: Float32Array): Promise<void> {
        return new Promise((resolve) => {
            const processedAudioData = this.preprocessAudio(audioData);

            const audioBuffer = this.audio.createBuffer(1, processedAudioData.length, this.audio.sampleRate);
            audioBuffer.getChannelData(0).set(processedAudioData);

            this.duration = audioBuffer.duration;

            if (this.currentSource) {
                this.currentSource.stop();
                this.currentSource.disconnect();
            }

            const source = this.audio.createBufferSource();
            source.playbackRate.value = 1.0;
            source.buffer = audioBuffer;
            source.connect(this.analyser);
            this.analyser.connect(this.audio.destination);

            // 終了処理
            source.onended = () => {

                this.isPlaying = false;
                this.lipReset();
                this.emit('ended');

                resolve();
            };

            //source.start(0);
            source.start(0, 0, audioBuffer.duration);
            this.pausedTime = this.audio.currentTime;
            this.currentSource = source;
            setTimeout(() => { this.isPlaying = true }, 200);
        });
    }

    // 読み込んだオーディオファイルを再生する
    async playLoadAudio(buffer: AudioBuffer): Promise<void> {
        return new Promise((resolve) => {
            if (buffer == null) return;

            if (this.currentSource) {
                this.currentSource.stop();
                this.currentSource.disconnect();
            }

            this.duration = buffer.duration;
            const source = this.audio.createBufferSource();
            source.playbackRate.value = 1.0;
            source.buffer = buffer;
            source.connect(this.analyser);
            this.analyser.connect(this.audio.destination);

             // 終了処理
            source.onended = () => {
                this.isPlaying = false;
                this.lipReset();
                this.emit('ended');
                resolve();
            };

            source.start(0);

            setTimeout(() => { this.isPlaying = true }, 200);
            this.pausedTime = this.audio.currentTime;
            this.currentSource = source;
        });
    }

    setVRM(vrm: VRM): void {
        this.vrm = vrm;
    }

    // LPC スペクトル包絡線
    private getSpectralEnvelope(analyser:any, smoothingWindow = 5) {

        // Initialize the data array to capture frequency data.
        const dataArray = analyser;

        // Array to store the smoothed envelope
        const envelope = new Float32Array(dataArray.length);

        // Apply a moving average for envelope smoothing
        for (let i = 0; i < dataArray.length; i++) {
          let sum = 0;
          let count = 0;
          for (let j = -smoothingWindow; j <= smoothingWindow; j++) {
            const index = i + j;
            if (index >= 0 && index < dataArray.length) {
              sum += dataArray[index];
              count++;
            }
          }
          envelope[i] = sum / count; // Average for smoothing
        }

        return envelope;
    }

    // リップシンクをする
    update( deltaTime: number ) {

        if (this.isPlaying) {

            //時間領域の波形データはgetByteTimeDomainDataメソッド
            //周波数領域の波形データはgetByteFrequencyDataメソッド
            this.analyser.getByteFrequencyData(this.dataArray); // 0~255

            // スペクトル包絡
            const waveArray = this.getSpectralEnvelope(this.dataArray, 5);

            // フェルトマン推定
            const formants = this.estimateFormants( waveArray, this.audio.sampleRate );

            // FFTから最大ボリュームを取得
            let volumes = [];
            for (let i = 0; i < this.analyser.fftSize / 2; i++) {
                volumes.push(Math.abs(this.dataArray[i]));
            }
            // 降順にソート
            volumes.sort((a, b) => b - a);
            // 上位4つを取得（必要に応じて長さを調整）
            const topVolumes = volumes.slice(0, 4);
            // 上位４つの平均にする
            this.volume = ( (topVolumes[0]+topVolumes[1]+topVolumes[2]+topVolumes[3]) * 0.25 ) / 255;


            if (this.vrm && this.vrm.expressionManager) {

                let mouseform = 'unknown';

                // 大きさを決める
                this.FicialParamVolume = this.volume < 0.5 ? 4 * this.volume * this.volume * this.volume : 1 - Math.pow(-2 * this.volume + 2, 3) / 2; //easeInOutCubic
                // 更新
                this.FicialParamVolume = this.FicialParamVolume * this.lipVolume; //　lipVolume=1.0 は調整用の変数

                    // 母音を判定します
                    mouseform = this.determineVowel(formants.F1, formants.F2);
                    console.log(`Detected vowel: ${mouseform}`);

                    if(mouseform != "unknown"){

                        // 減衰
                        this.Value_aa -= 2.0*deltaTime;
                        this.Value_ih -= 2.0*deltaTime;
                        this.Value_ou -= 2.0*deltaTime;
                        this.Value_ee -= 2.0*deltaTime;
                        this.Value_oh -= 2.0*deltaTime;
                        if(this.Value_aa<0)this.Value_aa=0;
                        if(this.Value_ih<0)this.Value_ih=0;
                        if(this.Value_ou<0)this.Value_ou=0;
                        if(this.Value_ee<0)this.Value_ee=0;
                        if(this.Value_oh<0)this.Value_oh=0;

                        // 各母音に値を設定
                        if(mouseform == "a"){
                            this.Value_aa = this.FicialParamVolume;

                        }else if(mouseform == "i"){
                            this.Value_ih = this.FicialParamVolume;

                        }else if(mouseform == "u"){
                            this.Value_ou = this.FicialParamVolume;

                        }else if(mouseform == "e"){
                            this.Value_ee = this.FicialParamVolume;

                        }else if(mouseform == "o"){
                            this.Value_oh = this.FicialParamVolume;

                        }else{
                            //

                        }

                    }else{

                        // 減衰
                        this.Value_aa -= 1.0*deltaTime;
                        this.Value_ih -= 1.0*deltaTime;
                        this.Value_ou -= 1.0*deltaTime;
                        this.Value_ee -= 1.0*deltaTime;
                        this.Value_oh -= 1.0*deltaTime;
                        if(this.Value_aa<0)this.Value_aa=0;
                        if(this.Value_ih<0)this.Value_ih=0;
                        if(this.Value_ou<0)this.Value_ou=0;
                        if(this.Value_ee<0)this.Value_ee=0;
                        if(this.Value_oh<0)this.Value_oh=0;

                    }

                    // モデルに適用
                    this.vrm.expressionManager.setValue('aa', this.Value_aa);
                    this.vrm.expressionManager.setValue('ih', this.Value_ih);
                    this.vrm.expressionManager.setValue('ou', this.Value_ou);
                    this.vrm.expressionManager.setValue('ee', this.Value_ee);
                    this.vrm.expressionManager.setValue('oh', this.Value_oh);
                    // 変数を更新
                    this.FicialParam.aa = this.Value_aa;
                    this.FicialParam.ih = this.Value_ih;
                    this.FicialParam.ou = this.Value_ou;
                    this.FicialParam.ee = this.Value_ee;
                    this.FicialParam.oh = this.Value_oh;
            }

        } else {
            this.volume = 0;
        }

        //return this.FicialParamAA;
    }

    // フォルマント推定（簡易版）
    private estimateFormants(frequencyData:any, sampleRate:number = this.audio.sampleRate ) {
        const nyquist = sampleRate / 2;
        const formants = {
            F1: null,
            F2: null,
        };

        // 周波数の範囲を設定（例：F1は200Hz-900Hz、F2は900Hz-3000Hz）
        const f1Range = [150, 900];
        const f2Range = [650, 3000];

        const f1IndexRange = [
            Math.floor(f1Range[0] / nyquist * frequencyData.length),
            Math.floor(f1Range[1] / nyquist * frequencyData.length)
        ];

        const f2IndexRange = [
            Math.floor(f2Range[0] / nyquist * frequencyData.length),
            Math.floor(f2Range[1] / nyquist * frequencyData.length)
        ];

        // F1（第一フォルマント）の検出
        let maxF1Value = -Infinity;
        for (let i = f1IndexRange[0]; i <= f1IndexRange[1]; i++) {
            if (frequencyData[i] > maxF1Value) {
                maxF1Value = frequencyData[i];
                //@ts-ignore
                formants.F1 = (i / frequencyData.length) * nyquist;
            }
        }

        // F2（第二フォルマント）の検出
        let maxF2Value = -Infinity;
        for (let i = f2IndexRange[0]; i <= f2IndexRange[1]; i++) {
            if (frequencyData[i] > maxF2Value) {
                maxF2Value = frequencyData[i];
                //@ts-ignore
                formants.F2 = (i / frequencyData.length) * nyquist;
            }
        }

        return formants;
    }

    // 母音判定（モデルカスタム）
    private determineVowel(F1:any, F2:any): string {
        if (F1 >= 420 && F1 <= 900 && F2 >= 960 && F2 <= 1800) {
            return 'a';  // 「あ」
        } else if (F1 >= 180 && F1 <= 650 && F2 >= 1800 && F2 <= 3000) {
            return 'i';  // 「い」
        } else if (F1 >= 180 && F1 <= 300 && F2 >= 650 && F2 <= 1800) {
            return 'u';  // 「う」
        } else if (F1 >= 300 && F1 <= 420 && F2 >= 960 && F2 <= 1800) {
            return 'e';  // 「え」
        } else if (F1 >= 300 && F1 <= 960 && F2 >= 650 && F2 <= 960) {
            return 'o';  // 「お」
        } else {
            return 'unknown';  // 判別できない場合
        }
    }

    // リップシンクの値をリセットする
    lipReset(): void{

        this.Value_aa = 0;
        this.Value_ih = 0;
        this.Value_ou = 0;
        this.Value_ee = 0;
        this.Value_oh = 0;

        if (this.vrm && this.vrm.expressionManager) {
            //すべてのパターンを０にして初期化させる
            this.vrm.expressionManager.setValue('aa', this.Value_aa);
            this.vrm.expressionManager.setValue('ih', this.Value_ih);
            this.vrm.expressionManager.setValue('ou', this.Value_ou);
            this.vrm.expressionManager.setValue('ee', this.Value_ee);
            this.vrm.expressionManager.setValue('oh', this.Value_oh);

            this.FicialParam.aa = this.Value_aa;
            this.FicialParam.ih = this.Value_ih;
            this.FicialParam.ou = this.Value_ou;
            this.FicialParam.ee = this.Value_ee;
            this.FicialParam.oh = this.Value_oh;
        }
    }

    // 再生中のオーディオを止める
    stopAudio(): void{
        if(this.currentSource){
            const source = this.currentSource;
            source.stop();
            source.onended;

            console.log('Audio stopped');
        }
    }

    getVolume(): number{
        return this.volume;
    }

    resume(): void{
        this.audio.resume();
    }


}