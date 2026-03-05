# AI 任务编排系统实现计划

## 背景与目标

### 问题
用户希望通过自然语言描述复杂的图像处理任务，例如"将 xx 图片背景透明，设置成 128x128 分辨率用于图标"，系统能够自动解析并按顺序执行多个工具/插件操作。

### 当前状态
- YingGe 已有完善的插件系统和内置工具（压缩、调整大小、去背景等）
- 已集成 OpenAI 兼容的 AI API，用于图像分析和语义搜索
- 工具和插件需要用户手动逐个调用，无法通过自然语言批量编排

### 目标
实现一个 AI 驱动的任务编排系统，能够：
1. 解析自然语言任务描述
2. 生成结构化的执行计划
3. 自动按顺序执行多个工具/插件
4. 支持单个和批量资源处理
5. 提供友好的对话式 UI

### 用户选择
- **触发方式**: 对话框输入（新增 AI 助手对话框）
- **执行方式**: 调用 AI API 解析任务
- **交互方式**: 自动执行
- **批量处理**: 支持批量处理多个资源

---

## 系统架构

### 核心组件

```
┌─────────────────────────────────────────────────────────┐
│                  AI 任务编排系统                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  前端层 (React/TypeScript)                              │
│  ┌───────────────────────────────────────────────────┐  │
│  │ AiAssistantDialog                                 │  │
│  │ - 用户输入任务描述                                │  │
│  │ - 显示解析后的任务计划                            │  │
│  │ - 显示执行进度和结果                              │  │
│  └───────────────────────────────────────────────────┘  │
│                         ↓                              │
│  ┌───────────────────────────────────────────────────┐  │
│  │ aiTaskService.ts                                  │  │
│  │ - parseTask()                                     │  │
│  │ - executeTask()                                   │  │
│  └───────────────────────────────────────────────────┘  │
│                         ↓                              │
├─────────────────────────────────────────────────────────┤
│  后端层 (Rust/Tauri)                                    │
│  ┌───────────────────────────────────────────────────┐  │
│  │ ToolRegistry                                      │  │
│  │ - 注册所有可用工具的元数据                        │  │
│  │ - 生成工具描述 JSON 供 AI 理解                    │  │
│  └───────────────────────────────────────────────────┘  │
│                         ↓                              │
│  ┌───────────────────────────────────────────────────┐  │
│  │ TaskParser                                        │  │
│  │ - 构建 AI prompt                                  │  │
│  │ - 调用 AI API 解析任务                            │  │
│  │ - 验证并返回 TaskPlan                             │  │
│  └───────────────────────────────────────────────────┘  │
│                         ↓                              │
│  ┌───────────────────────────────────────────────────┐  │
│  │ TaskExecutor                                      │  │
│  │ - 按顺序执行任务步骤                              │  │
│  │ - 调用内置工具或插件                              │  │
│  │ - 处理步骤间的数据传递                            │  │
│  │ - 发送进度事件到前端                              │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 实现细节

### 1. 文件结构

#### 新增文件

**后端 (Rust)**:
- `src-tauri/src/ai/tool_registry.rs` - 工具注册表
- `src-tauri/src/ai/task_parser.rs` - AI 任务解析器
- `src-tauri/src/ai/task_executor.rs` - 任务执行引擎
- `src-tauri/src/commands/ai_task.rs` - Tauri 命令

**前端 (TypeScript/React)**:
- `src/components/ai/AiAssistantDialog.tsx` - AI 助手对话框
- `src/components/ai/TaskPlanView.tsx` - 任务计划展示
- `src/components/ai/TaskProgressView.tsx` - 执行进度展示
- `src/types/aiTask.ts` - TypeScript 类型定义
- `src/services/aiTaskService.ts` - 前端服务层

#### 修改文件

- `src-tauri/src/lib.rs` - 注册新命令和状态
- `src-tauri/src/commands/mod.rs` - 导出 ai_task 模块
- `src-tauri/src/ai/mod.rs` - 导出新模块
- `src/App.tsx` - 添加 AI 助手对话框和菜单事件监听
- `src/i18n/locales/en.json` - 添加英文翻译
- `src/i18n/locales/zh.json` - 添加中文翻译

---

### 2. 核心数据结构

#### TaskPlan (Rust)
```rust
pub struct TaskPlan {
    pub id: String,
    pub description: String,
    pub steps: Vec<TaskStep>,
}

pub struct TaskStep {
    pub id: String,
    pub tool_name: String,
    pub tool_type: ToolType,
    pub parameters: serde_json::Value,
    pub description: String,
}

pub enum ToolType {
    BuiltIn(String),
    Plugin(String),
}
```

#### ToolMetadata (Rust)
```rust
pub struct ToolMetadata {
    pub name: String,
    pub display_name: String,
    pub description: String,
    pub tool_type: ToolType,
    pub parameters: Vec<ParameterDef>,
    pub supported_contexts: Vec<String>,
}

pub struct ParameterDef {
    pub name: String,
    pub param_type: String,
    pub description: String,
    pub required: bool,
    pub default: Option<serde_json::Value>,
    pub constraints: Option<ParameterConstraints>,
}
```

---

### 3. AI Prompt 设计

#### System Prompt 模板
```
You are an AI assistant for YingGe game asset management tool.
Parse natural language task descriptions into structured execution plans.

Available Tools:
{tool_registry_json}

User Request: {user_input}
Selected Assets: {asset_count} assets

Parse the request into a JSON task plan:
{
  "description": "Brief summary",
  "steps": [
    {
      "tool_name": "tool_name",
      "tool_type": "BuiltIn" or "Plugin",
      "parameters": {...},
      "description": "Step description"
    }
  ]
}

Rules:
1. Only use tools from the available tools list
2. Extract numeric parameters (e.g., "128x128" → width: 128, height: 128)
3. Order steps logically (e.g., remove background before resize)
4. Return ONLY valid JSON
```

#### 工具注册表 JSON 示例
```json
{
  "builtin_tools": [
    {
      "name": "remove_background",
      "display_name": "Remove Background",
      "description": "Remove background from images, making them transparent",
      "parameters": [
        {
          "name": "suffix",
          "type": "string",
          "description": "Suffix for output filename",
          "required": false,
          "default": "_nobg"
        }
      ],
      "context": ["single", "multiple"]
    },
    {
      "name": "resize_image",
      "display_name": "Resize Image",
      "description": "Resize images to specified dimensions",
      "parameters": [
        {
          "name": "width",
          "type": "number",
          "description": "Target width in pixels",
          "required": true,
          "constraints": { "min": 1, "max": 4096 }
        },
        {
          "name": "height",
          "type": "number",
          "description": "Target height in pixels",
          "required": true
        }
      ],
      "context": ["single", "multiple"]
    }
  ]
}
```

---

### 4. 执行流程

```
1. 用户在 AI 助手对话框输入任务描述
   例如: "将图片背景透明，设置成 128x128 分辨率"
   ↓
2. 前端调用 parseTask(input, assetIds, language)
   ↓
3. 后端 TaskParser:
   - 从 ToolRegistry 获取工具元数据
   - 构建 AI prompt
   - 调用 OpenAI 兼容 API
   - 解析 JSON 响应为 TaskPlan
   ↓
4. 前端显示 TaskPlan 给用户确认
   步骤 1: 移除背景
   步骤 2: 调整大小为 128x128
   ↓
5. 用户点击"执行"
   ↓
6. 前端调用 executeTask(taskPlan, assetIds)
   ↓
7. 后端 TaskExecutor:
   - 遍历 taskPlan.steps
   - 对每个资源执行每个步骤
   - 步骤 1: 调用 remove_background() → 生成新资源
   - 步骤 2: 使用新资源 ID 调用 resize_image()
   - 发送进度事件到前端
   ↓
8. 前端显示执行进度和最终结果
   ✓ 任务完成，处理了 3 个资源
```

---

### 5. 关键实现要点

#### 5.1 工具注册表 (ToolRegistry)

**位置**: `src-tauri/src/ai/tool_registry.rs`

**功能**:
- 在初始化时注册所有内置工具（remove_background, resize_image, compress_image 等）
- 从插件系统动态注册插件工具
- 生成工具描述 JSON 供 AI 理解
- 提供工具查询接口

**注册的工具**:
- `remove_background` - 移除背景
- `resize_image` - 调整大小
- `compress_image` - 压缩图片
- `crop_image` - 裁剪图片
- `merge_spritesheet` - 合并精灵图
- 所有已安装的插件

#### 5.2 任务解析器 (TaskParser)

**位置**: `src-tauri/src/ai/task_parser.rs`

**功能**:
- 构建包含工具元数据的 system prompt
- 调用 AI API（复用现有的 AiProviderManager）
- 解析 AI 返回的 JSON 为 TaskPlan
- 验证任务计划的有效性

**AI API 调用**:
- 使用 chat completion API（非 vision API）
- Temperature = 0.0（确保一致性）
- 返回纯 JSON（无 markdown）

#### 5.3 任务执行器 (TaskExecutor)

**位置**: `src-tauri/src/ai/task_executor.rs`

**功能**:
- 按顺序执行任务步骤
- 对每个资源执行每个步骤
- 处理步骤间的数据传递（新生成的资源 ID）
- 发送进度事件到前端
- 错误处理和部分失败处理

**执行逻辑**:
```rust
for step in task_plan.steps {
    for asset_id in current_asset_ids {
        match step.tool_type {
            BuiltIn(tool) => execute_builtin_tool(tool, params, asset_id),
            Plugin(name) => execute_plugin_tool(name, asset_id),
        }
    }
    // 如果步骤生成了新资源，更新 current_asset_ids
}
```

#### 5.4 前端对话框 (AiAssistantDialog)

**位置**: `src/components/ai/AiAssistantDialog.tsx`

**功能**:
- 输入框：用户输入任务描述
- 解析按钮：调用 AI 解析任务
- 任务计划展示：显示解析后的步骤
- 执行按钮：开始执行任务
- 进度展示：实时显示执行进度
- 结果展示：显示成功/失败信息

**状态管理**:
- `input` - 用户输入
- `parsing` - 解析中
- `taskPlan` - 解析后的计划
- `executing` - 执行中
- `result` - 执行结果
- `error` - 错误信息

---

### 6. 集成点

#### 6.1 菜单集成

在 `src-tauri/src/lib.rs` 的菜单构建中添加：

```rust
let ai_assistant_item = MenuItemBuilder::with_id("ai-assistant", "AI 助手")
    .accelerator("CmdOrCtrl+Shift+A")
    .build(app)?;

// 添加到工具菜单顶部
let tools_menu = SubmenuBuilder::new(app, "工具")
    .item(&ai_assistant_item)
    .separator()
    .item(&remove_bg_item)
    // ... 其他工具
    .build()?;
```

#### 6.2 App.tsx 集成

```typescript
// 添加状态
const [showAiAssistant, setShowAiAssistant] = useState(false);

// 添加事件监听
unlistenAiAssistant = await appWindow.listen("menu-ai-assistant", () => {
  setShowAiAssistant(true);
});

// 添加对话框
<AiAssistantDialog
  open={showAiAssistant}
  onClose={() => setShowAiAssistant(false)}
/>
```

#### 6.3 命令注册

在 `src-tauri/src/lib.rs` 的 `invoke_handler` 中添加：

```rust
.invoke_handler(tauri::generate_handler![
    // ... 现有命令
    commands::ai_task::ai_parse_task,
    commands::ai_task::ai_execute_task,
    commands::ai_task::get_tool_registry,
])
```

#### 6.4 状态管理

在 `src-tauri/src/lib.rs` 的 setup 中初始化：

```rust
// 初始化工具注册表
let tool_registry = Arc::new(RwLock::new(ToolRegistry::new()));

// 注册插件工具（在插件加载后）
let plugins = list_plugins().await?;
tool_registry.write().await.register_plugin_tools(plugins);

app.manage(tool_registry);
```

---

### 7. 多语言支持

#### 翻译键 (i18n)

**英文** (`src/i18n/locales/en.json`):
```json
{
  "ai": {
    "assistant": "AI Assistant",
    "describeTask": "Describe what you want to do",
    "exampleTask": "Example: Remove background and resize to 128x128 for icon",
    "assetsSelected": "assets selected",
    "parseTask": "Parse Task",
    "parsing": "Parsing...",
    "execute": "Execute",
    "executing": "Executing...",
    "taskCompleted": "Task Completed",
    "processedAssets": "Processed {{count}} assets",
    "newTask": "New Task",
    "taskPlan": "Task Plan",
    "step": "Step {{number}}"
  }
}
```

**中文** (`src/i18n/locales/zh.json`):
```json
{
  "ai": {
    "assistant": "AI 助手",
    "describeTask": "描述你想做什么",
    "exampleTask": "例如：移除背景并调整为 128x128 用于图标",
    "assetsSelected": "个资源已选中",
    "parseTask": "解析任务",
    "parsing": "解析中...",
    "execute": "执行",
    "executing": "执行中...",
    "taskCompleted": "任务完成",
    "processedAssets": "已处理 {{count}} 个资源",
    "newTask": "新任务",
    "taskPlan": "任务计划",
    "step": "步骤 {{number}}"
  }
}
```

---

### 8. 错误处理

#### 解析错误
- AI 返回无效 JSON → 提示用户重新描述
- AI 使用了不存在的工具 → 验证失败，提示可用工具
- 参数缺失或无效 → 使用默认值或提示用户

#### 执行错误
- 单个资源处理失败 → 记录错误，继续处理其他资源
- 工具调用失败 → 停止当前步骤，显示错误信息
- 部分成功 → 显示成功和失败的资源数量

#### 用户体验
- 所有错误都显示在对话框中
- 提供"重试"和"新任务"按钮
- 保留失败的任务计划供用户修改

---

### 9. 性能优化

#### AI API 调用
- 使用 temperature=0.0 确保一致性
- 限制 max_tokens 控制成本
- 缓存工具注册表 JSON（不需要每次重新生成）

#### 批量处理
- 并行处理多个资源（使用 tokio::spawn）
- 限制并发数量（避免资源耗尽）
- 实时发送进度事件

#### 前端优化
- 使用 React.memo 优化组件渲染
- 防抖输入框（避免频繁更新）
- 虚拟滚动（如果任务步骤很多）

---

### 10. 测试策略

#### 单元测试
- `ToolRegistry::register_tool()` - 工具注册
- `TaskParser::parse_task()` - 任务解析（mock AI API）
- `TaskExecutor::execute_step()` - 单步执行

#### 集成测试
- 完整流程：输入 → 解析 → 执行 → 结果
- 多步骤任务：去背景 + 调整大小
- 批量处理：多个资源

#### 手动测试场景
1. 单个资源，单个工具："移除背景"
2. 单个资源，多个工具："移除背景并调整为 128x128"
3. 多个资源，单个工具："压缩所有图片"
4. 多个资源，多个工具："移除背景并调整为 512x512"
5. 错误处理：无效输入、工具失败、部分失败

---

### 11. 未来扩展

#### 短期
- 支持更多内置工具（分割图片、合并精灵图等）
- 支持插件参数配置（目前插件不暴露参数）
- 任务历史记录（保存和重放任务）

#### 中期
- 条件执行（if-else 逻辑）
- 循环处理（对每个资源执行不同操作）
- 任务模板（保存常用任务为模板）

#### 长期
- 本地 LLM 支持（避免 API 调用）
- 可视化任务编辑器（拖拽式工作流）
- 任务调度（定时执行、批量队列）

---

## 验证计划

### 开发验证
1. 编译通过（Rust 和 TypeScript）
2. 单元测试通过
3. 集成测试通过

### 功能验证
1. 打开 AI 助手对话框
2. 输入任务描述："移除背景并调整为 128x128"
3. 点击"解析任务"，查看生成的任务计划
4. 点击"执行"，观察进度和结果
5. 验证生成的资源是否符合预期

### 边界情况验证
1. 无资源选中 → 提示用户选择资源
2. 无效输入 → AI 解析失败，显示错误
3. 工具执行失败 → 显示错误，部分成功
4. 多个资源批量处理 → 所有资源都被处理

---

## 关键文件清单

### 需要创建的文件
- `src-tauri/src/ai/tool_registry.rs`
- `src-tauri/src/ai/task_parser.rs`
- `src-tauri/src/ai/task_executor.rs`
- `src-tauri/src/commands/ai_task.rs`
- `src/components/ai/AiAssistantDialog.tsx`
- `src/components/ai/TaskPlanView.tsx`
- `src/components/ai/TaskProgressView.tsx`
- `src/types/aiTask.ts`
- `src/services/aiTaskService.ts`

### 需要修改的文件
- `src-tauri/src/lib.rs` - 菜单、命令注册、状态管理
- `src-tauri/src/commands/mod.rs` - 导出 ai_task 模块
- `src-tauri/src/ai/mod.rs` - 导出新模块
- `src/App.tsx` - 对话框和事件监听
- `src/i18n/locales/en.json` - 英文翻译
- `src/i18n/locales/zh.json` - 中文翻译

### 复用的现有文件
- `src-tauri/src/ai/provider.rs` - AI Provider（OpenAI 兼容）
- `src-tauri/src/commands/processing.rs` - 图片处理命令
- `src-tauri/src/commands/plugin.rs` - 插件管理
- `src/services/tauriBridge.ts` - Tauri 命令桥接
- `src/stores/appStore.ts` - 应用状态管理

---

## 技术挑战与解决方案

### 挑战 1: AI 理解工具能力
**问题**: AI 可能不准确理解工具的功能和参数

**解决方案**:
- 提供详细的工具描述和参数约束
- 使用结构化的 JSON schema
- 在 prompt 中提供示例
- 验证 AI 返回的任务计划

### 挑战 2: 参数提取
**问题**: 从自然语言中提取精确的参数值（如尺寸、质量）

**解决方案**:
- 在 prompt 中明确参数格式要求
- 提供参数约束（min/max）
- 使用 temperature=0.0 确保一致性
- 后端验证参数有效性

### 挑战 3: 步骤间数据传递
**问题**: 某些步骤生成新资源，后续步骤需要使用新资源 ID

**解决方案**:
- TaskExecutor 跟踪当前资源 ID 列表
- 每个步骤执行后更新资源 ID
- 支持 `depends_on` 字段（未来扩展）

### 挑战 4: 错误处理
**问题**: 批量处理时部分资源可能失败

**解决方案**:
- 记录每个资源的处理结果
- 继续处理其他资源（不中断）
- 在结果中显示成功和失败的数量
- 提供详细的错误信息

### 挑战 5: 成本控制
**问题**: 每次任务都调用 AI API，成本可能较高

**解决方案**:
- 使用较小的模型（如 gpt-3.5-turbo）
- 限制 max_tokens
- 缓存常见任务模式（未来扩展）
- 提供关键词匹配作为备选（未来扩展）

---

## 实现顺序

### 阶段 1: 基础架构（1-2 天）
1. 创建数据结构和类型定义
2. 实现 ToolRegistry
3. 注册内置工具元数据
4. 添加 Tauri 命令骨架

### 阶段 2: AI 集成（1-2 天）
1. 实现 TaskParser
2. 设计和测试 AI prompt
3. 实现 JSON 解析和验证
4. 单元测试

### 阶段 3: 执行引擎（2-3 天）
1. 实现 TaskExecutor
2. 集成内置工具调用
3. 实现进度事件
4. 错误处理和部分失败

### 阶段 4: 前端 UI（2-3 天）
1. 创建 AiAssistantDialog
2. 创建 TaskPlanView 和 TaskProgressView
3. 集成到 App.tsx
4. 添加菜单项

### 阶段 5: 测试和优化（1-2 天）
1. 集成测试
2. 手动测试各种场景
3. 性能优化
4. 文档和注释

**总计**: 约 7-12 天

---

## 总结

这个 AI 任务编排系统将为 YingGe 带来强大的自动化能力，用户可以通过自然语言描述复杂的图像处理任务，系统自动解析并执行。核心优势：

1. **智能解析**: 利用 AI 理解自然语言，无需学习命令语法
2. **自动编排**: 自动确定工具执行顺序，处理步骤间依赖
3. **批量处理**: 支持对多个资源执行相同的任务流程
4. **可扩展**: 自动识别新安装的插件，无需手动配置
5. **用户友好**: 对话式 UI，实时进度反馈，清晰的错误提示

通过复用现有的 AI 集成、插件系统和工具命令，实现成本较低，且能够无缝集成到现有架构中。
