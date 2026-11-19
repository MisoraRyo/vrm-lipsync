import * as THREE from "three";
import GUI from 'three/addons/libs/lil-gui.module.min.js';
import gsap from "gsap";
import { VRM } from "@pixiv/three-vrm";

export class VRMLookTarget {
    private vrm: VRM | null = null;
    public OuterLookAtRand: any[] = [];
    public InnerLookAtRand: any[] = [];
    public CenterLookAt: any[] = [];
    public lookAtTarget: any;
    StartPosX:number;
    StartPosY:number;

    constructor() {
      this.vrm = null;
      this.lookAtTarget = new THREE.Object3D();
      this.StartPosX = 0;
      this.StartPosY = 0;
    }

    // 初期セットアップ
    public setVRM(vrm: VRM, camera:THREE.Camera, gui:GUI) {
      this.vrm = vrm;
      camera.add( this.lookAtTarget );

      this.vrm.lookAt!.target = this.lookAtTarget;
      this.lookAtTarget.position.x = 0;
      this.lookAtTarget.position.y = 0;

      // GUI
      const LookTargetsMotionFolder = gui.addFolder('Character_lookTarget');
      LookTargetsMotionFolder.close()

      LookTargetsMotionFolder
      .add(this.lookAtTarget.position, 'x', -1, 1, 0.01)
      .name('X')
      .listen()

      LookTargetsMotionFolder
      .add(this.lookAtTarget.position, 'y', -1, 1, 0.01)
      .name('Y')
      .listen()

    }

    // 目線を移動させる
    public EyeTarget(px:number,py:number): void{
      this.lookAtTarget.position.x = px;
      this.lookAtTarget.position.y = py;
    }

    // 目線をアニメーションで移動させる
    public targetAnimation( targetPosX:number, targetPosY:number, duration:number ): void{
      this.StartPosX = this.lookAtTarget.position.x;
      this.StartPosY = this.lookAtTarget.position.y;
      
      // GSAPでアニメーションさせる
      gsap.to(this.lookAtTarget.position, {
        duration: duration,
        ease: "power2.out",
        x: targetPosX,
        y: targetPosY,
        onComplete: () => {
            this.lookAtTarget.position.x = targetPosX;
            this.lookAtTarget.position.y = targetPosY;
        }
    });
    }

    // 目線をよそみして戻るアニメーション
    // blinkと連動しています
    public YosomiAnimation(time: number = 0.6): void{

      const targetPosX = this.getRandomNum(-1.5, 1.5); /*-2~2*/
      const targetPosY = this.getRandomNum(-0.1, 0.1); /*-2~2*/

      this.StartPosX = this.lookAtTarget.position.x;
      this.StartPosY = this.lookAtTarget.position.y;

      gsap.to(this.lookAtTarget.position, {
        duration: time,
        ease: "power2.out",
        x: targetPosX,
        y: targetPosY,
        onComplete: () => {
            this.lookAtTarget.position.x = targetPosX;
            this.lookAtTarget.position.y = targetPosY;
            setTimeout(() => {
              this.targetAnimation( 0, 0, 0.2 ); //戻るアニメーション
            }, 400);
        }
      });

    };

    // 目線をよそみして戻るアニメーション
    // 条件下で小さく動作させます
    public YosomiAnimationSetBack(time: number = 0.6): void{

      const targetPosX = this.getRandomNum(-0.4, 0.4);
      const targetPosY = this.getRandomNum(-0.1, 0.1);

      this.StartPosX = this.lookAtTarget.position.x;
      this.StartPosY = this.lookAtTarget.position.y;

      // GSAPでアニメーションさせる
      gsap.to(this.lookAtTarget.position, {
        duration: time,
        ease: "power2.out",
        x: targetPosX,
        y: targetPosY,
        onComplete: () => {
            this.lookAtTarget.position.x = targetPosX;
            this.lookAtTarget.position.y = targetPosY;
            setTimeout(() => {
              this.targetAnimation( 0, 0, 0.4 ); //戻るアニメーション
            }, 400);
        }
      });

    };
    
    // ランダムな数値を取得する
    private getRandomNum(min = 0, max = 0): number{
      return Math.floor( Math.random() * (max - min + 1)) + min;
    }

}

