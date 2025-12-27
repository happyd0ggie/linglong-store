use std::{env, fs, io, path::Path};

pub fn should_disable_webkit_dmabuf_renderer() -> bool {
    if env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_some() {
        return false;
    }

    let dri_dir = Path::new("/dev/dri");
    let entries = match fs::read_dir(dri_dir) {
        Ok(entries) => entries,
        Err(err) => {
            return matches!(err.kind(), io::ErrorKind::NotFound | io::ErrorKind::PermissionDenied);
        }
    };

    let mut candidates: Vec<std::path::PathBuf> = Vec::new();
    for entry in entries.flatten() {
        let file_name = entry.file_name();
        let Some(name) = file_name.to_str() else {
            continue;
        };
        if name.starts_with("renderD") || name.starts_with("card") {
            candidates.push(entry.path());
        }
    }

    if candidates.is_empty() {
        return true;
    }

    let mut saw_permission_denied = false;
    for path in candidates {
        match std::fs::OpenOptions::new().read(true).write(true).open(&path) {
            Ok(_) => return false,
            Err(err) if err.kind() == io::ErrorKind::PermissionDenied => {
                saw_permission_denied = true;
            }
            Err(_) => {}
        }
    }

    saw_permission_denied
}
