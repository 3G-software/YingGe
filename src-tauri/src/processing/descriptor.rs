use crate::processing::spritesheet::SpritesheetInfo;

/// Generate a JSON descriptor for sprite sheets (generic / Godot-friendly)
pub fn generate_json_descriptor(
    info: &SpritesheetInfo,
    image_filename: &str,
) -> String {
    let json = serde_json::json!({
        "image": image_filename,
        "size": {
            "w": info.width,
            "h": info.height
        },
        "frames": info.frames.iter().map(|f| {
            serde_json::json!({
                "name": f.name,
                "frame": {
                    "x": f.x,
                    "y": f.y,
                    "w": f.width,
                    "h": f.height
                }
            })
        }).collect::<Vec<_>>()
    });

    serde_json::to_string_pretty(&json).unwrap_or_default()
}

/// Generate a Unity-style XML descriptor
pub fn generate_unity_xml_descriptor(
    info: &SpritesheetInfo,
    image_filename: &str,
) -> String {
    let mut xml = String::from("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
    xml.push_str(&format!(
        "<TextureAtlas imagePath=\"{}\" width=\"{}\" height=\"{}\">\n",
        image_filename, info.width, info.height
    ));
    for frame in &info.frames {
        xml.push_str(&format!(
            "  <SubTexture name=\"{}\" x=\"{}\" y=\"{}\" width=\"{}\" height=\"{}\" />\n",
            frame.name, frame.x, frame.y, frame.width, frame.height
        ));
    }
    xml.push_str("</TextureAtlas>\n");
    xml
}

/// Generate a Cocos2d plist-style descriptor (simplified XML plist)
pub fn generate_cocos2d_plist_descriptor(
    info: &SpritesheetInfo,
    image_filename: &str,
) -> String {
    let mut plist = String::from("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
    plist.push_str("<!DOCTYPE plist PUBLIC \"-//Apple//DTD PLIST 1.0//EN\" \"http://www.apple.com/DTDs/PropertyList-1.0.dtd\">\n");
    plist.push_str("<plist version=\"1.0\">\n<dict>\n");
    plist.push_str("  <key>frames</key>\n  <dict>\n");

    for frame in &info.frames {
        plist.push_str(&format!("    <key>{}</key>\n    <dict>\n", frame.name));
        plist.push_str(&format!(
            "      <key>frame</key>\n      <string>{{{{{},{}}},{{{},{}}}}}</string>\n",
            frame.x, frame.y, frame.width, frame.height
        ));
        plist.push_str(&format!(
            "      <key>sourceSize</key>\n      <string>{{{},{}}}</string>\n",
            frame.width, frame.height
        ));
        plist.push_str("    </dict>\n");
    }

    plist.push_str("  </dict>\n");
    plist.push_str("  <key>metadata</key>\n  <dict>\n");
    plist.push_str(&format!(
        "    <key>textureFileName</key>\n    <string>{}</string>\n",
        image_filename
    ));
    plist.push_str(&format!(
        "    <key>size</key>\n    <string>{{{},{}}}</string>\n",
        info.width, info.height
    ));
    plist.push_str("  </dict>\n");
    plist.push_str("</dict>\n</plist>\n");
    plist
}
