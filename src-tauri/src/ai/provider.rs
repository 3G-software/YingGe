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
    pub suggested_name: Option<String>,
}

#[async_trait]
pub trait AiProvider: Send + Sync {
    async fn analyze_image(
        &self,
        image_base64: &str,
        mime_type: &str,
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
    ) -> Result<AnalysisResult, AppError> {
        let data_url = format!("data:{};base64,{}", mime_type, image_base64);

        let body = serde_json::json!({
            "model": self.model,
            "messages": [
                {
                    "role": "system",
                    "content": "You are an asset tagging system for game development. Analyze the given image and return a JSON object with:\n1. \"tags\": array of objects with \"name\" (lowercase, English), \"category\" (one of: content, style, color, mood, use_case), \"confidence\" (0-1)\n2. \"description\": one concise English sentence describing the asset\n3. \"suggested_name\": a descriptive filename in snake_case without extension\n\nReturn ONLY valid JSON, no markdown."
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
                            "text": "Analyze this game asset image. Return JSON with tags, description, and suggested_name."
                        }
                    ]
                }
            ],
            "max_tokens": 1000,
            "temperature": 0.3
        });

        let url = format!("{}/chat/completions", self.endpoint);
        let resp = self
            .client
            .post(&url)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| AppError::Ai(format!("HTTP request failed: {}", e)))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(AppError::Ai(format!(
                "API returned {}: {}",
                status, text
            )));
        }

        let json: serde_json::Value = resp.json().await
            .map_err(|e| AppError::Ai(format!("Failed to parse response: {}", e)))?;

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

        let result: AnalysisResult = serde_json::from_str(clean)
            .map_err(|e| AppError::Ai(format!("Failed to parse AI response as JSON: {}. Raw: {}", e, clean)))?;

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

        let url = format!("{}/embeddings", self.endpoint);
        let resp = self
            .client
            .post(&url)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| AppError::Ai(format!("Embedding request failed: {}", e)))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(AppError::Ai(format!(
                "Embedding API returned {}: {}",
                status, text
            )));
        }

        let json: serde_json::Value = resp.json().await
            .map_err(|e| AppError::Ai(format!("Failed to parse embedding response: {}", e)))?;

        let embedding = json["data"][0]["embedding"]
            .as_array()
            .ok_or_else(|| AppError::Ai("No embedding in response".to_string()))?
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

        let url = format!("{}/chat/completions", self.endpoint);
        let resp = self
            .client
            .post(&url)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| AppError::Ai(format!("Connection test failed: {}", e)))?;

        Ok(resp.status().is_success())
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
