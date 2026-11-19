import * as THREE from 'three';
import { VRM } from "@pixiv/three-vrm";

export class EyeBlinkController {
  private vrm: VRM | null = null;
  private EyetimerClearTimeout: number[] = [];
  private eyeInterval: number = 2000;
  private EyeFlag: boolean = false;
  public FicialParam: any;
  public NowExpression: string = '';
  public Blink_Value: { [key: string]: number } = {};
  private animationFrameId: number| null = null;
  //
  private lookTarget: any; //外部関数

  constructor(vrm: VRM, initialExpression: string, Param:any, BlinkParam: { [key: string]: number }, lookTarget: any) {
    this.vrm = vrm;
    this.EyeFlag = false;
    this.NowExpression = initialExpression;
    this.FicialParam = Param;
    this.animationFrameId = null;
    this.Blink_Value = BlinkParam;
    //　↓外部関数
    this.lookTarget = lookTarget;
  }

  // Clears all active intervals
  public clearAllIntervals(): void {
    this.EyetimerClearTimeout.forEach(id => clearInterval(id));
    this.EyetimerClearTimeout = [];
  }

  // Main eye blink function
  private EyeFunction(): void {
    this.clearAllIntervals();
    this.animateBlink( 0, 1, 400, true);
  }

  // まばたきを停止する
  public EyeStop(): void {
    console.log("Blinking stopped");

    this.clearAllIntervals();
    this.EyeFlag = false;

    this.vrm!.expressionManager!.setValue("blinkLeft", 0.0);
    this.vrm!.expressionManager!.setValue("blinkRight", 0.0);

    this.stopAnimation()
  }

  // まばたきを開始する
  public EyeStart(): void {
    if (!this.EyeFlag) {
      console.log("Blinking started");

      this.EyetimerClearTimeout.push(
        setInterval(() => this.EyeFunction(), this.eyeInterval) as unknown as number
      );
      this.EyeFlag = true;
    } else {
      console.log("Blinking already running");
    }
  }

  // 一度だけまばたきするアニメーション
  public EyeOnceShot(): void {
    console.log("Blinking OnceShot");
    if (!this.EyeFlag) {
        this.animateBlink( 0, 1, 300, false);
    } else {
        console.log("Blinking already running");
        this.EyeStop();
        this.animateBlink( 0, 1, 300, false);
    }
  }

  // Update expression if needed
  public updateExpression(newExpression: string): void {
    this.NowExpression = newExpression;
  }

  // ブリンクするアニメーションを実行する
  private animateBlink(startValue: number, endValue: number, duration: number, loop:boolean) {
    if (!this.vrm) return;

    const startTime = performance.now(); // Start time of the animation
    const animate = (currentTime: number) => {

      // Calculate how much time has passed
      const elapsedTime = currentTime - startTime;
      const progress = Math.min(elapsedTime / duration, 1); // Progress between 0 and 1

      // Interpolate the blink value based on the progress
      const blinkValue = this.lerp(startValue, endValue, progress);
      const value = THREE.MathUtils.smootherstep(blinkValue, 0, 0.4) - THREE.MathUtils.smootherstep(blinkValue, 0.4, 1.0);

      // 各表情のブリンク値を参照してその値を設定します。
      const hosei =  this.Blink_Value[ this.NowExpression ];

      if (hosei === undefined) {
        this.vrm!.expressionManager!.setValue("blinkLeft", value * 0.0);
        this.vrm!.expressionManager!.setValue("blinkRight", value * 0.0);

        //this.FicialParam.blink = value;
        this.FicialParam.blinkLeft = value * 0;
        this.FicialParam.blinkRight = value * 0;

      } else {
        this.vrm!.expressionManager!.setValue("blinkLeft", value * hosei);
        this.vrm!.expressionManager!.setValue("blinkRight", value * hosei);

        //this.FicialParam.blink = value;
        this.FicialParam.blinkLeft = value * hosei;
        this.FicialParam.blinkRight = value * hosei;
      }


      // Continue the animation if not complete
      if (progress < 1) {
        this.animationFrameId = requestAnimationFrame(animate);
      } else {
        // Animation complete, reset to 0 (optional)
        this.vrm!.expressionManager!.setValue("blinkLeft", 0);
        this.vrm!.expressionManager!.setValue("blinkRight", 0);
        this.animationFrameId = null;

        //
        if(loop == true){

            // ★目パチの間隔をランダムに設定
            this.eyeInterval = Math.random() * 4000 + 2000; // 2s ~ 6s に１回ランダムにまばたきします。

            this.EyetimerClearTimeout.push(
                setInterval(() => this.EyeFunction(), this.eyeInterval) as unknown as number
            );

            // ★★目線をそらすアニメーション★★
            // 80%の割合で目線をそらして、元に戻すアニメーション
            if (Math.random() < 4/5) {

                if (this.lookTarget && typeof this.lookTarget.YosomiAnimation === 'function') {
                  const lookatTime = this.eyeInterval - 700; // 400+400 
                  setTimeout(() => {
                    this.lookTarget.YosomiAnimation( 0.4 )
                  }, lookatTime)as unknown as number
                }

            }

        }


      }

    };

    // Start the animation
    this.animationFrameId = requestAnimationFrame(animate);
  }

  // Easing
  private lerp(start: number, end: number, t: number): number {
    return start * (1 - t) + end * t;
  }

  // Cancel animation if needed
  private stopAnimation(): void{
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  // 瞬きを制御する用
  public blinkTarget(R:number,L:number): void{
    this.FicialParam.blinkLeft = R;
    this.FicialParam.blinkRight = L;
    this.vrm!.expressionManager!.setValue("blinkLeft", this.FicialParam.blinkLeft);
    this.vrm!.expressionManager!.setValue("blinkRight", this.FicialParam.blinkRight);
  }


}