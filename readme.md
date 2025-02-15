# koishi-plugin-p-graze

[![npm](https://img.shields.io/npm/v/koishi-plugin-p-graze?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-p-graze) [![MIT License](https://img.shields.io/badge/license-MIT-blue.svg?style=flat)](http://choosealicense.com/licenses/mit/) ![Language](https://img.shields.io/badge/language-TypeScript-brightgreen) ![Static Badge](https://img.shields.io/badge/QQ交流群-2167028216-green)

东方风轮盘赌插件，需配合 [p-qiandao](https://github.com/username/p-qiandao) 使用。提供负收益的赌博机制和排行榜功能，赌狗慎用（doge）

---

## 功能特性

- **擦弹游戏**：高风险低收益的轮盘赌机制
- **动态排行榜**：实时统计群组成员P点与好感度
- **多群组支持**：不同群组独立记录数据

---

## 安装指南

```bash
# 通过 npm 安装
npm install koishi-plugin-p-graze
# 或通过koishi插件市场安装
```

```ts
// koishi.yml 配置示例
plugins:
  p-graze:
    adminUsers:
      - '123456789'  # 管理员用户ID
    deadline: 1600    # 积分警戒线
    bonus: 5000       # 轮盘奖金池基数
    outputLogs: true  # 启用操作日志
```

---

## 指令说明

### 擦弹游戏 `p-graze`
- **别名**：擦弹
- **参数**：`[tag]`（保留参数，暂未使用）
- **说明**：
  参与轮盘赌游戏。子弹数为 6 时开始新回合，命中概率随剩余子弹数动态变化。
- **示例**：
  ```
  p-graze
  > [系统] 擦弹成功！获得 320 P点，剩余 5 发子弹
  ```
  ```
  p-graze
  > [系统] 轰——！你损失了 1800 P点
  ```

### P点排行 `p-list`
- **别名**：p点排行
- **参数**：
  - `[pagesize:number]`：显示条目数（默认10）
  - `-f, --full`：显示完整榜单
- **示例**：
  ```
  p-list 5
  > 本群p点排行：
  > 1. 灵梦：9821 P点
  > 2. 魔理沙：7643 P点
  ...
  ```

### 好感排行 `favorability-list`
- **别名**：好感排行
- **参数**：
  - `[pagesize:number]`：显示条目数（默认10）
  - `-f, --full`：显示完整榜单
- **说明**：
  基于用户互动频率生成的隐藏属性
- **示例**：
  ```
  favorability-list -f
  > 本群好感排行：
  > 1. 早苗
  > 2. 琪露诺
  ...
  ```

---

## 机制说明

### 擦弹规则
1. 初始子弹数为 6，命中概率 = 1/当前子弹数
2. 命中时：
   - 损失 `(1/子弹数)*当前P点`
   - 奖金池增加损失值的 50%
3. 未命中时：
   - 获得 `(7-子弹数)/12 * 奖金池`
   - 子弹数减 1
4. 当子弹数为 1 时，奖金池自动增加配置的 `bonus` 值

---

## 注意事项

1. 需要配合数据库插件使用（如 mysql）
2. 每日 00:00 重置擦弹状态（基于配置的 `Offset` 时区偏移）
3. 管理员用户可通过配置 `adminUsers` 绕过限制
4. 推荐配合 [p-qiandao](https://github.com/username/p-qiandao) 签到插件使用

---

## 问题反馈
如有问题请提交 Issue 至 [GitHub仓库](https://github.com/koishi-plugin-p-graze)
