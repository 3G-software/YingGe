use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginManifest {
    pub name: String,
    pub version: String,
    pub description: String,
    pub author: String,
    pub license: String,
    pub entry: String,
    #[serde(default)]
    pub permissions: Vec<String>,
    #[serde(default)]
    pub actions: Vec<PluginAction>,
    #[serde(default)]
    pub settings: Vec<PluginSetting>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginAction {
    pub id: String,
    pub label: String,
    #[serde(default)]
    pub icon: String,
    #[serde(default)]
    pub context: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginSetting {
    pub key: String,
    pub label: String,
    #[serde(rename = "type")]
    pub setting_type: String,
    #[serde(default)]
    pub default: serde_json::Value,
}

impl PluginManifest {
    pub fn from_json(json: &str) -> Result<Self, serde_json::Error> {
        serde_json::from_str(json)
    }
}
