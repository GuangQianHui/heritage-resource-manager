# API 文档

非遗文化传承智能体助手的完整 API 接口文档。

## 基础信息

- **基础 URL**: `http://localhost:3001/api`
- **内容类型**: `application/json`
- **字符编码**: `UTF-8`

## 认证

目前 API 不需要认证，但建议在生产环境中添加适当的认证机制。

## 通用响应格式

### 成功响应

```json
{
  "success": true,
  "data": {
    // 响应数据
  },
  "message": "操作成功"
}
```

### 错误响应

```json
{
  "success": false,
  "error": "错误描述",
  "details": "详细错误信息"
}
```

## 资源管理 API

### 获取所有资源

**GET** `/api/resources/load-all`

获取指定分类的所有资源。

#### 查询参数

| 参数       | 类型   | 必需 | 默认值 | 说明                 |
| ---------- | ------ | ---- | ------ | -------------------- |
| `category` | string | 否   | -      | 资源分类             |
| `page`     | number | 否   | 1      | 页码                 |
| `limit`    | number | 否   | 1000   | 每页数量             |
| `search`   | string | 否   | -      | 搜索关键词           |
| `tags`     | string | 否   | -      | 标签过滤（逗号分隔） |

#### 示例请求

```bash
# 获取所有资源
GET /api/resources/load-all

# 获取特定分类的资源
GET /api/resources/load-all?category=traditionalFoods

# 搜索资源
GET /api/resources/load-all?search=北京烤鸭

# 分页获取
GET /api/resources/load-all?page=1&limit=50
```

#### 响应示例

```json
{
  "success": true,
  "data": {
    "resources": [
      {
        "id": "北京烤鸭",
        "title": "北京烤鸭",
        "description": "北京特色名菜",
        "category": "traditionalFoods",
        "tags": ["北京菜", "烤鸭"],
        "keywords": ["北京", "烤鸭", "特色菜"],
        "location": "北京",
        "history": "历史渊源...",
        "technique": "制作工艺...",
        "features": "特色描述...",
        "funFact": "有趣小知识...",
        "media": [
          {
            "name": "beijing-duck.jpg",
            "type": "image",
            "size": 1024000,
            "url": "http://localhost:3001/resources/images/beijing-duck.jpg"
          }
        ],
        "createdAt": "2025-08-25T10:00:00.000Z",
        "updatedAt": "2025-08-25T10:00:00.000Z"
      }
    ],
    "total": 322,
    "page": 1,
    "limit": 1000,
    "pages": 1
  }
}
```

### 批量操作资源

**POST** `/api/resources/batch`

批量创建、更新或删除资源。

#### 请求体

```json
{
  "operation": "create|update|delete",
  "resources": [
    {
      "id": "资源ID",
      "title": "资源标题",
      "description": "资源描述",
      "category": "traditionalFoods"
      // ... 其他字段
    }
  ]
}
```

#### 操作类型

- `create`: 创建新资源
- `update`: 更新现有资源
- `delete`: 删除资源

#### 示例请求

```bash
# 创建资源
POST /api/resources/batch
Content-Type: application/json

{
  "operation": "create",
  "resources": [
    {
      "title": "新资源",
      "description": "资源描述",
      "category": "traditionalFoods"
    }
  ]
}
```

#### 响应示例

```json
{
  "success": true,
  "data": {
    "created": 1,
    "updated": 0,
    "deleted": 0,
    "errors": []
  },
  "message": "批量操作完成"
}
```

### 搜索资源

**GET** `/api/resources/search`

高级搜索功能。

#### 查询参数

| 参数       | 类型   | 必需 | 说明         |
| ---------- | ------ | ---- | ------------ |
| `q`        | string | 是   | 搜索关键词   |
| `category` | string | 否   | 分类过滤     |
| `tags`     | string | 否   | 标签过滤     |
| `location` | string | 否   | 地理位置过滤 |
| `page`     | number | 否   | 页码         |
| `limit`    | number | 否   | 每页数量     |

#### 示例请求

```bash
GET /api/resources/search?q=传统美食&category=traditionalFoods&tags=北京菜
```

#### 响应示例

```json
{
  "success": true,
  "data": {
    "results": [
      // 搜索结果
    ],
    "total": 15,
    "query": "传统美食",
    "filters": {
      "category": "traditionalFoods",
      "tags": ["北京菜"]
    }
  }
}
```

### 导出资源

**POST** `/api/resources/export`

导出指定资源为指定格式。

#### 请求体

```json
{
  "resources": [
    {
      "category": "traditionalFoods",
      "id": "北京烤鸭"
    }
  ],
  "format": "json|csv",
  "filename": "export-data"
}
```

#### 参数说明

| 参数        | 类型   | 必需 | 说明                 |
| ----------- | ------ | ---- | -------------------- |
| `resources` | array  | 是   | 要导出的资源列表     |
| `format`    | string | 是   | 导出格式（json/csv） |
| `filename`  | string | 否   | 文件名（不含扩展名） |

#### 示例请求

```bash
POST /api/resources/export
Content-Type: application/json

{
  "resources": [
    {"category": "traditionalFoods", "id": "北京烤鸭"},
    {"category": "traditionalArchitecture", "id": "故宫"}
  ],
  "format": "json",
  "filename": "heritage-data"
}
```

#### 响应示例

```json
{
  "success": true,
  "data": [
    {
      "id": "北京烤鸭",
      "title": "北京烤鸭",
      "category": "traditionalFoods"
      // ... 完整资源数据
    }
  ]
}
```

## 文件管理 API

### 上传文件

**POST** `/api/resources/upload`

上传媒体文件。

#### 请求格式

`multipart/form-data`

#### 表单字段

| 字段         | 类型   | 必需 | 说明          |
| ------------ | ------ | ---- | ------------- |
| `file`       | file   | 是   | 要上传的文件  |
| `category`   | string | 否   | 文件分类      |
| `resourceId` | string | 否   | 关联的资源 ID |

#### 支持的文件类型

- **图片**: jpg, jpeg, png, gif, webp, bmp, svg
- **视频**: mp4, avi, mov, wmv, flv, mkv, webm
- **音频**: mp3, wav, ogg, aac, flac, m4a
- **文档**: pdf, doc, docx, txt, rtf, odt

#### 示例请求

```bash
POST /api/resources/upload
Content-Type: multipart/form-data

file: [文件内容]
category: images
resourceId: 北京烤鸭
```

#### 响应示例

```json
{
  "success": true,
  "data": {
    "filename": "2025-08-25T10-00-00-beijing-duck.jpg",
    "originalName": "beijing-duck.jpg",
    "size": 1024000,
    "type": "image/jpeg",
    "url": "http://localhost:3001/resources/images/2025-08-25T10-00-00-beijing-duck.jpg"
  },
  "message": "文件上传成功"
}
```

### 访问静态文件

**GET** `/resources/{type}/{filename}`

访问上传的静态文件。

#### 路径参数

| 参数       | 类型   | 说明                                      |
| ---------- | ------ | ----------------------------------------- |
| `type`     | string | 文件类型（images/videos/audio/documents） |
| `filename` | string | 文件名                                    |

#### 示例请求

```bash
GET /resources/images/2025-08-25T10-00-00-beijing-duck.jpg
```

## 统计信息 API

### 获取统计信息

**GET** `/api/resources/stats`

获取系统统计信息。

#### 示例请求

```bash
GET /api/resources/stats
```

#### 响应示例

```json
{
  "success": true,
  "data": {
    "statistics": {
      "totalCategories": 6,
      "totalResources": 322,
      "totalMedia": 57,
      "totalFileSize": 91108757,
      "resourceUsage": {
        "withMedia": 53,
        "withoutMedia": 269,
        "recentlyUpdated": 38,
        "recentlyCreated": 0,
        "highQuality": 319,
        "incomplete": 0
      },
      "contentQuality": {
        "withHistory": 322,
        "withTechnique": 319,
        "withFeatures": 319,
        "withFunFact": 319,
        "withTags": 322,
        "withKeywords": 322
      },
      "popularTags": {
        "传统美食": 25,
        "北京菜": 15,
        "烤鸭": 8
      },
      "popularKeywords": {
        "传统": 45,
        "美食": 32,
        "文化": 28
      },
      "categories": {
        "traditionalFoods": {
          "resourceCount": 77,
          "mediaCount": 34,
          "totalSize": 82570985
        }
      },
      "fileTypes": {
        ".jpg": 34,
        ".png": 5,
        ".mp4": 3
      }
    }
  }
}
```

## 错误码说明

| 状态码 | 说明           |
| ------ | -------------- |
| 200    | 请求成功       |
| 400    | 请求参数错误   |
| 404    | 资源不存在     |
| 429    | 请求过于频繁   |
| 500    | 服务器内部错误 |

## 速率限制

- **普通 API**: 500 次/15 分钟
- **批量操作**: 100 次/15 分钟
- **文件上传**: 50 次/15 分钟

## 示例代码

### JavaScript (Fetch API)

```javascript
// 获取所有资源
async function getResources() {
  const response = await fetch("http://localhost:3001/api/resources/load-all");
  const data = await response.json();
  return data;
}

// 创建资源
async function createResource(resource) {
  const response = await fetch("http://localhost:3001/api/resources/batch", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      operation: "create",
      resources: [resource],
    }),
  });
  return await response.json();
}

// 上传文件
async function uploadFile(file, category, resourceId) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("category", category);
  formData.append("resourceId", resourceId);

  const response = await fetch("http://localhost:3001/api/resources/upload", {
    method: "POST",
    body: formData,
  });
  return await response.json();
}
```

### cURL

```bash
# 获取统计信息
curl -X GET http://localhost:3001/api/resources/stats

# 搜索资源
curl -X GET "http://localhost:3001/api/resources/search?q=传统美食"

# 导出资源
curl -X POST http://localhost:3001/api/resources/export \
  -H "Content-Type: application/json" \
  -d '{
    "resources": [{"category": "traditionalFoods", "id": "北京烤鸭"}],
    "format": "json"
  }'
```

## 更新日志

- **v1.0.0**: 初始 API 版本
- 支持完整的 CRUD 操作
- 文件上传和管理
- 统计信息查询
- 数据导出功能

---

_更多详细信息请参考项目文档或联系开发团队。_
