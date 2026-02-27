use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;

use crate::error::AppError;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SuggestedTag {
    pub name: String,
    pub category: String,
    pub confidence: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalysisResult {
    pub tags: Vec<SuggestedTag>,
    pub description: String,
    pub description_en: String,
    pub description_zh: String,
    pub suggested_name: Option<String>,
}

#[async_trait]
pub trait AiProvider: Send + Sync {
    async fn analyze_image(
        &self,
        image_base64: &str,
        mime_type: &str,
        language: &str,
    ) -> Result<AnalysisResult, AppError>;

    async fn embed_text(&self, text: &str) -> Result<Vec<f32>, AppError>;

    async fn test_connection(&self) -> Result<bool, AppError>;
}

/// OpenAI-compatible API provider (works with OpenAI, compatible endpoints, etc.)
pub struct OpenAiCompatibleProvider {
    client: reqwest::Client,
    endpoint: String,
    api_key: String,
    model: String,
    embedding_model: String,
}

impl OpenAiCompatibleProvider {
    pub fn new(
        endpoint: String,
        api_key: String,
        model: String,
        embedding_model: String,
    ) -> Self {
        Self {
            client: reqwest::Client::new(),
            endpoint: endpoint.trim_end_matches('/').to_string(),
            api_key,
            model,
            embedding_model,
        }
    }
}

#[async_trait]
impl AiProvider for OpenAiCompatibleProvider {
    async fn analyze_image(
        &self,
        image_base64: &str,
        mime_type: &str,
        language: &str,
    ) -> Result<AnalysisResult, AppError> {
        let data_url = format!("data:{};base64,{}", mime_type, image_base64);

        // Build language-specific prompt
        let (tag_lang_instruction, tag_lang_example) = if language == "zh" {
            ("tags in Chinese", "角色, 背景, 道具")
        } else {
            ("tags in English (lowercase)", "character, background, prop")
        };

        let system_prompt = format!(
            "You are an asset tagging system for game development. Analyze the given image and return a JSON object with:\n\
            1. \"tags\": array of objects with \"name\" ({}), \"category\" (one of: content, style, color, mood, use_case), \"confidence\" (0-1)\n\
            2. \"description_en\": one concise English sentence describing the asset\n\
            3. \"description_zh\": one concise Chinese sentence describing the asset (用中文描述)\n\
            4. \"suggested_name\": a descriptive filename in snake_case without extension\n\n\
            Example tag names: {}\n\
            Return ONLY valid JSON, no markdown.",
            tag_lang_instruction, tag_lang_example
        );

        let body = serde_json::json!({
            "model": self.model,
            "messages": [
                {
                    "role": "system",
                    "content": system_prompt
                },
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": { "url": data_url }
                        },
                        {
                            "type": "text",
                            "text": "Analyze this game asset image. Return JSON with tags, description_en, description_zh, and suggested_name."
                        }
                    ]
                }
            ],
            "max_tokens": 1000,
            "temperature": 0.0
        });

        tracing::info!("=== AI Vision Request ===");
        tracing::info!("Model: {}", self.model);
        tracing::info!("Temperature: 0.0");
        tracing::info!("Max tokens: 1000");
        tracing::info!("Image size: {} bytes (base64)", image_base64.len());
        tracing::info!("Mime type: {}", mime_type);
        tracing::info!("=========================");

        // Smart URL construction:
        // If endpoint already contains chat/completions path, use it directly
        // Otherwise append /chat/completions to the base URL
        let url = if self.endpoint.contains("/chat/completions") {
            tracing::info!("Using endpoint as complete URL (contains /chat/completions)");
            self.endpoint.clone()
        } else {
            tracing::info!("Appending /chat/completions to base endpoint");
            format!("{}/chat/completions", self.endpoint)
        };

        tracing::info!("=== AI Vision Request ===");
        tracing::info!("URL: {}", url);
        tracing::info!("Model: {}", self.model);
        tracing::info!("========================");

        tracing::info!("Sending HTTP POST request...");
        let resp = match self
            .client
            .post(&url)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
        {
            Ok(r) => {
                tracing::info!("HTTP request sent successfully");
                r
            }
            Err(e) => {
                tracing::error!("=== HTTP Request Failed ===");
                tracing::error!("Error type: {}", e);
                if e.is_timeout() {
                    tracing::error!("Error reason: Request timeout");
                } else if e.is_connect() {
                    tracing::error!("Error reason: Connection failed - cannot reach server");
                } else if e.is_request() {
                    tracing::error!("Error reason: Request error");
                } else if e.is_body() {
                    tracing::error!("Error reason: Body error");
                } else {
                    tracing::error!("Error reason: Unknown");
                }
                tracing::error!("Full error: {:?}", e);
                tracing::error!("==========================");
                return Err(AppError::Ai(format!("HTTP request failed: {}", e)));
            }
        };

        let status = resp.status();
        tracing::info!("=== AI Response ===");
        tracing::info!("Status: {}", status);

        if !status.is_success() {
            let text = resp.text().await.unwrap_or_default();
            tracing::error!("Error response: {}", text);
            return Err(AppError::Ai(format!(
                "API returned {}: {}",
                status, text
            )));
        }

        let json: serde_json::Value = resp.json().await
            .map_err(|e| AppError::Ai(format!("Failed to parse response: {}", e)))?;

        tracing::info!("AI analysis completed successfully");
        tracing::info!("==================");

        let content = json["choices"][0]["message"]["content"]
            .as_str()
            .ok_or_else(|| AppError::Ai("No content in response".to_string()))?;

        // Try to parse the content as JSON
        let clean = content
            .trim()
            .trim_start_matches("```json")
            .trim_start_matches("```")
            .trim_end_matches("```")
            .trim();

        tracing::info!("=== AI Raw Response ===");
        tracing::info!("{}", clean);
        tracing::info!("=======================");

        // Parse as generic JSON first, then map to AnalysisResult
        let raw: serde_json::Value = serde_json::from_str(clean)
            .map_err(|e| AppError::Ai(format!("Failed to parse AI response as JSON: {}. Raw: {}", e, clean)))?;

        // Extract descriptions - support both old format (description) and new format (description_en/description_zh)
        let description_en = raw.get("description_en")
            .and_then(|v| v.as_str())
            .or_else(|| raw.get("description").and_then(|v| v.as_str()))
            .unwrap_or("")
            .to_string();
        let description_zh = raw.get("description_zh")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        let tags: Vec<SuggestedTag> = raw.get("tags")
            .and_then(|v| serde_json::from_value(v.clone()).ok())
            .unwrap_or_default();

        let suggested_name = raw.get("suggested_name")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let result = AnalysisResult {
            tags,
            description: description_en.clone(),
            description_en,
            description_zh,
            suggested_name,
        };

        tracing::info!("=== AI Vision Response ===");
        tracing::info!("Description (EN): {}", result.description_en);
        tracing::info!("Description (ZH): {}", result.description_zh);
        tracing::info!("Tags: {:?}", result.tags.iter().map(|t| &t.name).collect::<Vec<_>>());
        tracing::info!("==========================");

        Ok(result)
    }

    async fn embed_text(&self, text: &str) -> Result<Vec<f32>, AppError> {
        if self.embedding_model.is_empty() {
            return Err(AppError::Ai("No embedding model configured".to_string()));
        }

        let body = serde_json::json!({
            "model": self.embedding_model,
            "input": text
        });

        // Smart URL construction:
        // If endpoint already contains embeddings path, use it directly
        // If endpoint contains /chat/completions, replace it with /embeddings
        // Otherwise append /embeddings to the base URL
        let url = if self.endpoint.contains("/embeddings") {
            tracing::info!("Using endpoint as complete URL (contains /embeddings)");
            self.endpoint.clone()
        } else if self.endpoint.contains("/chat/completions") {
            tracing::info!("Replacing /chat/completions with /embeddings in endpoint");
            self.endpoint.replace("/chat/completions", "/embeddings")
        } else {
            tracing::info!("Appending /embeddings to base endpoint");
            format!("{}/embeddings", self.endpoint)
        };

        tracing::info!("=== Embedding Request ===");
        tracing::info!("URL: {}", url);
        tracing::info!("Model: {}", self.embedding_model);
        tracing::info!("Text length: {} chars", text.len());
        tracing::info!("========================");

        tracing::info!("Sending embedding HTTP request...");
        let resp = match self
            .client
            .post(&url)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
        {
            Ok(r) => {
                tracing::info!("Embedding HTTP request sent successfully");
                r
            }
            Err(e) => {
                tracing::error!("=== Embedding HTTP Request Failed ===");
                tracing::error!("Error type: {}", e);
                if e.is_timeout() {
                    tracing::error!("Error reason: Request timeout");
                } else if e.is_connect() {
                    tracing::error!("Error reason: Connection failed - cannot reach server");
                } else if e.is_request() {
                    tracing::error!("Error reason: Request error");
                } else if e.is_body() {
                    tracing::error!("Error reason: Body error");
                } else {
                    tracing::error!("Error reason: Unknown");
                }
                tracing::error!("Full error: {:?}", e);
                tracing::error!("====================================");
                return Err(AppError::Ai(format!("Embedding request failed: {}", e)));
            }
        };

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            tracing::error!("Embedding API error - Status: {}, Response: {}", status, text);
            return Err(AppError::Ai(format!(
                "Embedding API returned {}: {}",
                status, text
            )));
        }

        let resp_text = resp.text().await
            .map_err(|e| AppError::Ai(format!("Failed to read embedding response: {}", e)))?;

        tracing::info!("Embedding response received, parsing JSON...");

        let json: serde_json::Value = serde_json::from_str(&resp_text)
            .map_err(|e| {
                tracing::error!("Failed to parse embedding response as JSON: {}", e);
                tracing::error!("Raw response: {}", resp_text);
                AppError::Ai(format!("Failed to parse embedding response: {}", e))
            })?;

        let embedding = json["data"][0]["embedding"]
            .as_array()
            .ok_or_else(|| {
                tracing::error!("No embedding array in response. JSON structure: {}", json);
                AppError::Ai("No embedding in response".to_string())
            })?
            .iter()
            .filter_map(|v| v.as_f64().map(|f| f as f32))
            .collect();

        Ok(embedding)
    }

    async fn test_connection(&self) -> Result<bool, AppError> {
        let body = serde_json::json!({
            "model": self.model,
            "messages": [{"role": "user", "content": "Hi"}],
            "max_tokens": 5
        });

        // Smart URL construction
        let url = if self.endpoint.contains("/chat/completions") {
            tracing::info!("Using endpoint as complete URL (contains /chat/completions)");
            self.endpoint.clone()
        } else {
            tracing::info!("Appending /chat/completions to base endpoint");
            format!("{}/chat/completions", self.endpoint)
        };

        tracing::info!("=== Testing AI Connection ===");
        tracing::info!("URL: {}", url);
        tracing::info!("Model: {}", self.model);
        tracing::info!("============================");

        tracing::info!("Sending test HTTP request...");
        let resp = match self
            .client
            .post(&url)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
        {
            Ok(r) => {
                tracing::info!("Test HTTP request sent successfully");
                r
            }
            Err(e) => {
                tracing::error!("=== Connection Test Failed ===");
                tracing::error!("Error type: {}", e);
                if e.is_timeout() {
                    tracing::error!("Error reason: Request timeout");
                } else if e.is_connect() {
                    tracing::error!("Error reason: Connection failed - cannot reach server");
                    tracing::error!("Possible causes:");
                    tracing::error!("  1. Wrong endpoint URL");
                    tracing::error!("  2. Network firewall blocking the connection");
                    tracing::error!("  3. Server is down or unreachable");
                    tracing::error!("  4. DNS resolution failed");
                } else if e.is_request() {
                    tracing::error!("Error reason: Request error");
                } else if e.is_body() {
                    tracing::error!("Error reason: Body error");
                } else {
                    tracing::error!("Error reason: Unknown");
                }
                tracing::error!("Full error: {:?}", e);
                tracing::error!("=============================");
                return Err(AppError::Ai(format!("Connection test failed: {}", e)));
            }
        };

        let status = resp.status();
        tracing::info!("=== Connection Test Response ===");
        tracing::info!("Status: {}", status);

        if !status.is_success() {
            let text = resp.text().await.unwrap_or_default();
            tracing::error!("Error response: {}", text);
            tracing::info!("===============================");
        } else {
            tracing::info!("Connection test successful!");
            tracing::info!("===============================");
        }

        Ok(status.is_success())
    }
}

/// Manages the active AI provider, allowing runtime switching
pub struct AiProviderManager {
    provider: RwLock<Option<Arc<dyn AiProvider>>>,
}

impl AiProviderManager {
    pub fn new() -> Self {
        Self {
            provider: RwLock::new(None),
        }
    }

    pub async fn set_provider(&self, provider: Arc<dyn AiProvider>) {
        let mut lock = self.provider.write().await;
        *lock = Some(provider);
    }

    pub async fn get_provider(&self) -> Result<Arc<dyn AiProvider>, AppError> {
        let lock = self.provider.read().await;
        lock.clone()
            .ok_or_else(|| AppError::Ai("No AI provider configured. Please configure an AI provider in Settings.".to_string()))
    }

    pub async fn has_provider(&self) -> bool {
        self.provider.read().await.is_some()
    }
}
