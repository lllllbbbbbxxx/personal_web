const statusElement = document.getElementById("status");
const fps = document.getElementById("fps");
const poseLabel = document.getElementById("poseLabel");
const modeLabel = document.getElementById("modeLabel");

// 获取页面元素（video, canvas）
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d"); // 用于绘制摄像头画面和特效

statusElement.textContent = "HTML and CSS loaded";

let animationFrameId = null; // 用于管理主循环的动画帧ID

function setStatus(text) {
  statusElement.textContent = text; // 更新状态显示
}

function resizeCanvasToVideo() { // 调整canvas大小以匹配视频流
  const width = video.videoWidth || 720;
  const height = video.videoHeight || 1280;
  canvas.width = width;
  canvas.height = height;
}

async function initApp() {
    await Promise.all([
        loadImages(),
        loadTfjsModel(), // 加载tfjs模型
        initMediaPipe(), // 初始化MediaPipe
    ]);

    await startCamera(); // 开启摄像头
    loop(); // 启动主循环
}

// 由于打不开摄像头，用ai解决了摄像头问题
async function startCamera() { // 启动摄像头并处理权限问题
  if (!window.isSecureContext) { // 这通常意味着页面必须通过HTTPS或localhost访问
    setStatus("Camera unavailable: open from https:// or localhost.");
    modeLabel.textContent = "Mode: insecure context";
    return;
  }

  if (!navigator.mediaDevices?.getUserMedia) { // 检查浏览器是否支持getUserMedia
    setStatus("Camera API unavailable in this browser/context.");
    modeLabel.textContent = "Mode: unsupported";
    return;
  }

  try { // 请求摄像头权限并获取视频流
    setStatus("Requesting camera access...");
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" ,
        width: { ideal: 720 },
    height: { ideal: 1280 },
    aspectRatio: { ideal: 9 / 16 }
      },
      audio: false,
    });

    video.srcObject = stream;
    await video.play();
    resizeCanvasToVideo();

    setStatus("Camera ready");
    fps.textContent = "FPS: live";
    poseLabel.textContent = "Pose: none";
    modeLabel.textContent = "Mode: camera on";
  } catch (error) {
    console.error(error);
    setStatus(explainCameraError(error));
    modeLabel.textContent = "Mode: camera error";
  }
}

video.addEventListener("loadedmetadata", resizeCanvasToVideo); // 当视频元数据加载完成时调整canvas大小
window.addEventListener("resize", resizeCanvasToVideo);// 当窗口大小改变时调整canvas大小

// 加载道具图片资源（由ai优化）
async function loadImages() { // 加载图片资源
  props.cooker = {
    lefthand: await loadImage("assets/chef_tool1.png"),
    righthand: await loadImage("assets/chef_tool2.png"),
    head: await loadImage("assets/chef_hat.png")
  };
    props.start = {
    body: await loadImage("assets/bodypart/body.png"),
    head: await loadImage("assets/bodypart/head.png"),
    leftArm: await loadImage("assets/bodypart/left_arm.png"),
    rightArm: await loadImage("assets/bodypart/right_arm.png"),
    leftUpperArm: await loadImage("assets/bodypart/left_upperarm.png"),
    rightUpperArm: await loadImage("assets/bodypart/right_upperarm.png"),
    leftThigh: await loadImage("assets/bodypart/left_thigh.png"),
    rightThigh: await loadImage("assets/bodypart/right_thigh.png"),
    leftFoot: await loadImage("assets/bodypart/left_foot.png"),
    rightFoot: await loadImage("assets/bodypart/right_foot.png")
  };
}

function loadImage(src) { // 加载图片资源，返回一个Promise，加载成功时解析为Image对象，加载失败时拒绝
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

const props = {}; // 用于存储加载的图片资源

// 锚点对齐函数（by ai）
function drawImageWithAnchor(ctx, img, x, y, w, h, ax = 0.5, ay = 0.5) { // 在(x, y)位置绘制图片，ax和ay定义了图片的锚点位置，默认为中心
  const drawX = x - w * ax;
  const drawY = y - h * ay;
  ctx.drawImage(img, drawX, drawY, w, h);
}

// 旋转函数（by ai）
function drawImageCentered(ctx, img, x, y, width, height, angle = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.drawImage(img, -width / 2, -height / 2, width, height);
  ctx.restore();
}
// 画肢体函数（by ai）
function drawLimbAnchored(
  ctx,
  canvas,
  img,
  startLm,
  endLm,
  widthScale = 0.3,
  angleOffset = 0,
  startAnchorY = 0.15,
  endAnchorY = 0.8
) {
  if (!startLm || !endLm) return;

  // landmark -> 像素
  const startX = startLm.x * canvas.width;
  const startY = startLm.y * canvas.height;
  const endX = endLm.x * canvas.width;
  const endY = endLm.y * canvas.height;

  // 两点距离 = 锚点之间的目标距离
  const targetLength = distance(startX, startY, endX, endY);

  // 根据锚点区间，反推出整张图应该多长（by ai）
  const anchorSpan = endAnchorY - startAnchorY;
  if (anchorSpan <= 0) return;

  const imgHeight = targetLength / anchorSpan;
  const imgWidth = imgHeight * widthScale;

  // 图片中心不再是两点中点，要按锚点比例重新算（by ai）
  const centerRatioY = (startAnchorY + endAnchorY) / 2;
  const offsetToCenter = (0.5 - centerRatioY) * imgHeight;

  // 两点中点
  const midX = (startX + endX) / 2;
  const midY = (startY + endY) / 2;

  // 两点方向角
  const angle = Math.atan2(endY - startY, endX - startX) + angleOffset;

  // 沿着肢体方向，把中心点往前/往后挪
  const centerX = midX + Math.cos(angle - angleOffset) * offsetToCenter;
  const centerY = midY + Math.sin(angle - angleOffset) * offsetToCenter;

  drawImageCentered(ctx, img, centerX, centerY, imgWidth, imgHeight, angle);
}

// start函数（by ai）
function drawStartSuit(ctx, canvas, landmarks, props) {
  if (!landmarks) return;

  // 取关键点
  const nose = landmarks[0];
  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const leftElbow = landmarks[13];
  const rightElbow = landmarks[14];
  const leftWrist = landmarks[15];
  const rightWrist = landmarks[16];
  const leftHip = landmarks[23];
  const rightHip = landmarks[24];
  const leftKnee = landmarks[25];
  const rightKnee = landmarks[26];
  const leftAnkle = landmarks[27];
  const rightAnkle = landmarks[28];

  // 重要点必须有
  if (!nose || !leftShoulder || !rightShoulder || !leftHip || !rightHip) return;

  // 先算肩宽
  const leftShoulderX = leftShoulder.x * canvas.width;
  const leftShoulderY = leftShoulder.y * canvas.height;
  const rightShoulderX = rightShoulder.x * canvas.width;
  const rightShoulderY = rightShoulder.y * canvas.height;

  const shoulderWidth = distance(
    leftShoulderX, leftShoulderY,
    rightShoulderX, rightShoulderY
  );

  // 画头
  const noseX = nose.x * canvas.width;
  const noseY = nose.y * canvas.height;

  const headSize = shoulderWidth * 1.1;

  drawImageWithAnchor(
    ctx,
    props.start.head,
    noseX,
    noseY - shoulderWidth * 0.4,
    headSize,
    headSize,
    0.5, 0
  );

  // 画左右小腿/脚
  drawLimbAnchored(ctx, canvas, props.start.leftFoot, leftKnee, leftAnkle, 0.4, - Math.PI / 2, 0.15, 0.8);
  drawLimbAnchored(ctx, canvas, props.start.rightFoot, rightKnee, rightAnkle, 0.4, - Math.PI / 2, 0.15, 0.8);

  // 画左右大腿
  drawLimbAnchored(ctx, canvas, props.start.leftThigh, leftHip, leftKnee, 0.5, - Math.PI / 2, 0.15, 0.8);
  drawLimbAnchored(ctx, canvas, props.start.rightThigh, rightHip, rightKnee, 0.5, - Math.PI / 2, 0.15, 0.8);

  // 画左右上臂
  drawLimbAnchored(ctx, canvas, props.start.leftUpperArm, leftShoulder, leftElbow, 0.4, - Math.PI / 2, 0.15, 0.8);
  drawLimbAnchored(ctx, canvas, props.start.rightUpperArm, rightShoulder, rightElbow, 0.4, - Math.PI / 2, 0.15, 0.8);

  // 画身体
  const leftHipX = leftHip.x * canvas.width;
  const leftHipY = leftHip.y * canvas.height;
  const rightHipX = rightHip.x * canvas.width;
  const rightHipY = rightHip.y * canvas.height;

  const shoulderMidX = (leftShoulderX + rightShoulderX) / 2;
  const shoulderMidY = (leftShoulderY + rightShoulderY) / 2;
  const hipMidX = (leftHipX + rightHipX) / 2;
  const hipMidY = (leftHipY + rightHipY) / 2;

  const bodyCenterX = (shoulderMidX + hipMidX) / 2;
  const bodyCenterY = (shoulderMidY + hipMidY) / 2;
  const bodyWidth = shoulderWidth * 1.5;
  const bodyHeight = distance(shoulderMidX, shoulderMidY, hipMidX, hipMidY) * 1.3;

  drawImageCentered(ctx, props.start.body, bodyCenterX, bodyCenterY, bodyWidth, bodyHeight, 0);

  // 画左右前臂
  drawLimbAnchored(ctx, canvas, props.start.leftArm, leftElbow, leftWrist, 0.4, - Math.PI / 2, 0.15, 0.8);
  drawLimbAnchored(ctx, canvas, props.start.rightArm, rightElbow, rightWrist, 0.4, - Math.PI / 2, 0.15, 0.8);
}

// Cooker函数
function drawCooker(ctx, canvas, landmarks, props) {
  if (!landmarks)return;
    const leftWrist = landmarks[15];
    const rightWrist = landmarks[16];
    const head = landmarks[0];
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];

  if (!leftWrist || !rightWrist)return;
    const leftWristX = leftWrist.x * canvas.width; // 将归一化的x坐标转换为canvas坐标
    const leftWristY = leftWrist.y * canvas.height;
    const rightWristX = rightWrist.x * canvas.width;
    const rightWristY = rightWrist.y * canvas.height;
    const headX = head.x * canvas.width;
    const headY = head.y * canvas.height;
    const leftX = leftShoulder.x * canvas.width;
    const leftY = leftShoulder.y * canvas.height;
    const rightX = rightShoulder.x * canvas.width;
    const rightY = rightShoulder.y * canvas.height;

    const shoulderWidth = distance(leftX, leftY, rightX, rightY);
    const hatWidth = shoulderWidth * 0.8;
    const hatHeight = hatWidth * 0.9;
    const toolWidth = shoulderWidth * 0.8;
    const toolHeight = toolWidth * 2;
    drawImageWithAnchor(ctx, props.cooker.righthand, rightWristX, rightWristY, toolWidth, toolHeight, 0.5, 0.5);
    drawImageWithAnchor(ctx, props.cooker.lefthand, leftWristX, leftWristY, toolWidth, toolHeight, 0.5, 0.5);
    drawImageWithAnchor(ctx, props.cooker.head, headX, headY - shoulderWidth * 0.3, hatWidth, hatHeight);
}

// 当前特效状态
function drawCurrentForm(ctx, canvas, landmarks, props, baseForm, currentProp) {
  // 先画皮肤
  if (baseForm === "start") {
    drawStartSuit(ctx, canvas, landmarks, props);
  }
  // 再画道具
if (currentProp === "cooker") {
    drawCooker(ctx, canvas, landmarks, props);
  }
}

// 加载tfjs模型
let tfjsModel;

async function loadTfjsModel() {
  setStatus("Loading TensorFlow.js model...");
  try {
    // 根据模型类型加载模型
    const model = await tf.loadLayersModel("model/model.json?v=20260319_1");

    tfjsModel = model; // 保存模型实例
  } catch (error) {
    console.error(error);
    setStatus("Failed to load TensorFlow.js model");
    throw error;
  }
}

// 初始化MediaPipe
let pose;
let poseResults; // MediaPipe Pose的推理结果

// 参考来源：MediaPipe Pose legacy solution API 官方文档
async function initMediaPipe() {
  pose = new Pose({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
  }); // 创建MediaPipe Pose实例，并指定资源文件的加载路径
  pose.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    enableSegmentation: false,
    smoothSegmentation: false,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
  pose.onResults((results) => {
    poseResults = results; // 保存MediaPipe的推理结果，供主循环使用
  });
  statusElement.textContent = "MediaPipe initialized"; // 更新状态显示
}

// 画出mediapipe的关键点
function drawPoseLandmarks(landmarks) {
  if (!landmarks) return;

  ctx.fillStyle = "red";

  for (const landmark of landmarks) {
    const x = landmark.x * canvas.width;
    const y = landmark.y * canvas.height;

    ctx.beginPath();
    ctx.arc(x, y, 5, 0, 2 * Math.PI);
    ctx.fill();
  }
}

function distance3D(a, b) { // 计算3D空间中两点之间的距离，z坐标如果不存在则默认为0（by ai）
  return Math.hypot(a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0));
}

function normalizeLandmarks(landmarks) { // 对关键点进行归一化处理，使其具有平移和缩放不变性（by ai）
  if (!landmarks || landmarks.length !== 33) return null;

  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const leftHip = landmarks[23];
  const rightHip = landmarks[24];

  if (!leftShoulder || !rightShoulder || !leftHip || !rightHip) return null;

  const center = {
    x: (leftShoulder.x + rightShoulder.x + leftHip.x + rightHip.x) / 4,
    y: (leftShoulder.y + rightShoulder.y + leftHip.y + rightHip.y) / 4,
    z: ((leftShoulder.z ?? 0) + (rightShoulder.z ?? 0) + (leftHip.z ?? 0) + (rightHip.z ?? 0)) / 4,
  };

  const shoulderCenter = {
    x: (leftShoulder.x + rightShoulder.x) / 2,
    y: (leftShoulder.y + rightShoulder.y) / 2,
    z: ((leftShoulder.z ?? 0) + (rightShoulder.z ?? 0)) / 2,
  };
  const hipCenter = {
    x: (leftHip.x + rightHip.x) / 2,
    y: (leftHip.y + rightHip.y) / 2,
    z: ((leftHip.z ?? 0) + (rightHip.z ?? 0)) / 2,
  };

  const shoulderWidth = distance3D(leftShoulder, rightShoulder);
  const torsoLength = distance3D(shoulderCenter, hipCenter);
  const scale = Math.max(shoulderWidth, torsoLength, 1e-6);

  return landmarks.map((landmark) => ({
    x: (landmark.x - center.x) / scale,
    y: (landmark.y - center.y) / scale,
    z: ((landmark.z ?? 0) - center.z) / scale,
  }));
}

// 模型推理
// landmarks转换成99维数组
function landmarksToInputArray(landmarks) {
    if (!landmarks)return null;
    const inputArray = [];
    for (const landmark of landmarks) {
        inputArray.push(landmark.x, landmark.y, landmark.z);
        }
    return inputArray;
    }
// 99维数组送入tfjs模型，得到概率输出
async function predictPose(inputArray) {
    if (!tfjsModel || !inputArray)return null;
    const inputTensor = tf.tensor2d([inputArray]); // 将输入数组转换为TensorFlow.js张量，形状为[1, 99]
    const outputTensor = tfjsModel.predict(inputTensor); // 使用模型进行预测，得到输出张量

    const probabilities = await outputTensor.data(); // 从输出张量中获取数据，得到类别概率数组
    inputTensor.dispose();
    outputTensor.dispose();
    return probabilities; // 返回类别概率数组
}
// 概率最高的类别即为当前姿势
const poseLabels = ["cooker", "start"]; // 定义类别标签
function getPoseLabel(probabilities) {
    if (!probabilities)return null;
    const maxIndex = probabilities.indexOf(Math.max(...probabilities)); // 找到概率最高的类别索引
    if (probabilities[maxIndex] < confidenceThreshold)return "unknown"; // 如果最高概率低于置信度阈值，返回"unknown"
    return poseLabels[maxIndex] || "unknown"; // 返回对应的姿势标签
}

function distance(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1); // 计算两点之间的距离
}

// 特效状态
let systemState = "idle";    // idle / ready
let baseForm = "none";       // none / start
let currentProp = "none";    // none / cooker

let candidateProp = "none";
let candidateStartTime = 0;
const SWITCH_HOLD_MS = 1200; // 需要持续这个时间才切换
let lastStartToggleTime = 0;
const startToggleLockMs = 5000;

// 开启摄像头
initApp();

// 姿势检测间隔
let lastPredictTime = 0;
// pose置信度
const confidenceThreshold = 0.8; // 定义一个置信度阈值，只有当预测的概率超过这个值时才认为检测到该姿势

// 主循环（每帧）
async function loop() { // 主循环：每帧执行一次
  if (pose) {
    await pose.send({ image: video }); // 将当前视频帧发送给MediaPipe进行处理，结果会在回调中保存到poseResults
  }

  // 每帧都执行以下绘制逻辑
  ctx.clearRect(0, 0, canvas.width, canvas.height); // 清除canvas上的内容，为新的一帧做准备
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height); // 将当前视频帧绘制到canvas上
    if (poseResults && poseResults.poseLandmarks) { // 检测对象存在且有关键点数据
        const landmarks = poseResults.poseLandmarks; // 获取关键点数据
        drawPoseLandmarks(poseResults.poseLandmarks); // 画出关键点
        // 更新检测结果
        drawCurrentForm(ctx, canvas, landmarks, props, baseForm, currentProp);

// 每隔0.5秒进行一次姿势推理
      const currentTime = performance.now(); // 获取当前时间
        if (currentTime - lastPredictTime > 500) {
            lastPredictTime = currentTime; // 更新上次推理的时间
      const inputArray = landmarksToInputArray(poseResults.poseLandmarks); // 将关键点转换为输入数组
      const probabilities = await predictPose(inputArray); // 得到类别概率
      const poseLabelText = getPoseLabel(probabilities); // 获取当前姿势标签
      poseLabel.textContent = `Pose: ${poseLabelText}`; // 更新页面上的姿势显示
      const now = performance.now();

// 判断当前姿势，更新特效状态机（by ai）
const isPropPose = poseLabelText === "cooker";

      // 未变身时：只有 start 能触发变身
      if (systemState === "idle") {
        if (poseLabelText === "start") {
          systemState = "ready";
          baseForm = "start";
          currentProp = "none";
          candidateProp = "none";
          candidateStartTime = 0;
          lastStartToggleTime = now;
          console.log("开始变身：穿上高雅人士皮肤");
        }
      }

      // 如果当前已经变身
      else if (systemState === "ready") {
        // 再次检测到 start：超过5秒才允许取消变身
        if (poseLabelText === "start") {
          if (now - lastStartToggleTime >= startToggleLockMs) {
            lastStartToggleTime = now;
            systemState = "idle";
            baseForm = "none";
            currentProp = "none";
            candidateProp = "none";
            candidateStartTime = 0;
            console.log("取消变身，回到普通状态");
          }
        }

        // 检测到道具动作
        else if (isPropPose) {
          if (poseLabelText === currentProp) {
            candidateProp = "none";
            candidateStartTime = 0;
          } else if (candidateProp !== poseLabelText) {
            candidateProp = poseLabelText;
            candidateStartTime = now;
            console.log("开始尝试切换到：", candidateProp);
          } else if (now - candidateStartTime >= SWITCH_HOLD_MS) {
            currentProp = candidateProp;
            candidateProp = "none";
            candidateStartTime = 0;
            console.log("确认切换到：", currentProp);
          }
        }

        // 既不是 start，也不是道具动作
        else {
          candidateProp = "none";
          candidateStartTime = 0;
        }
      }
    }
  }

  animationFrameId = requestAnimationFrame(loop); // 请求下一帧继续循环
}
