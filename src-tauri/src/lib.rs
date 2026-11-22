use std::fs;
use std::process::Command;

#[tauri::command]
fn save_project_dialog(default_name: String, content: String) -> Result<Option<String>, String> {
  // Intentar kdialog (KDE) y como alternativa zenity (GTK/GNOME)
  let output = Command::new("kdialog")
    .args([
      "--getsavefilename",
      &default_name,
      "*.aclab|Proyecto AcousticLAB (*.aclab)",
    ])
    .output()
    .or_else(|_| {
      Command::new("zenity")
        .args([
          "--file-selection",
          "--save",
          "--confirm-overwrite",
          &format!("--filename={default_name}"),
          "--file-filter=*.aclab",
        ])
        .output()
    })
    .map_err(|e| format!("No se pudo abrir el diálogo de guardado: {e}"))?;

  if !output.status.success() {
    // El usuario canceló el diálogo
    return Ok(None);
  }

  let mut path = String::from_utf8_lossy(&output.stdout).trim().to_string();
  if path.is_empty() {
    return Ok(None);
  }
  if !path.ends_with(".aclab") {
    path.push_str(".aclab");
  }

  fs::write(&path, content).map_err(|e| format!("Error al guardar el archivo: {e}"))?;
  Ok(Some(path))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![save_project_dialog])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while building tauri application");
}
