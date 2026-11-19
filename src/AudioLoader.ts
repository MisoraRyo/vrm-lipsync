//
// オーディオファイルを読み込んで、格納しておく処理
//

import * as THREE from "three";

export interface audioConfig {
  url: string;
  name: string;
}

export async function loadAudio( Audio_PATH : audioConfig[] ): Promise<any> {

  const audioLoader = new THREE.AudioLoader();

  // 複数のオーディオを読み込む
  const loadPromises = Audio_PATH.map((data, index) => {

    return new Promise((resolve, reject) => {
        audioLoader.load(
          data.url,
          ( audioBuffer ) => {
            resolve(audioBuffer);
          },
          // Progress
          (progress) =>{
            //console.log("Loading model...", 100.0 * (progress.loaded / progress.total), "%")
          },
          // // onError callback
          (err: unknown)  => {
            console.log( index +  ' An error happened' );
            reject(new Error("Failed to load AudioFile"));
          }
        );

    });

  });

  // すべてのPromiseが完了するのを待つ
  try {
    const audiosPromei = await Promise.all(loadPromises);
    console.log("All Audio Files loaded successfully");
    return audiosPromei;
  } catch (error) {
    console.error("Error loading one or more audio files", error);
    throw error;
  }

}