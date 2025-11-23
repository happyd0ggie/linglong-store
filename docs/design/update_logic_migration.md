# Update Logic Migration Design

## Overview

This document outlines the design for migrating the application update check logic from the legacy Electron-based `linglong-store` to the new Tauri-based `rust-linglong-store`.

## Background

In the legacy application, the update check was performed in the frontend (`index.vue`) by:

1. Iterating through the list of installed applications.
2. Sending an IPC message (`ll-cli search` or `ll-cli query`) for *each* application sequentially.
3. Listening for the IPC result, parsing the output, and comparing versions in the frontend.

This approach resulted in high IPC traffic and mixed business logic with UI code.

## New Architecture

The new architecture moves the heavy lifting to the Rust backend, exposing a single Tauri command to the frontend.

### Backend (Rust)

**Command:** `check_for_updates`

**Responsibility:**

1. **Retrieve Installed Apps:** Calls `get_installed_apps` to get the current list of installed Linglong applications.
2. **Query Remote Repository:** For each installed application, it executes `ll-cli search <app_id> --json` to fetch available versions from the remote repository.
3. **Version Comparison:** It parses the JSON output and compares the remote version with the local installed version using a semantic versioning comparison strategy.
4. **Filter:** It filters out `devel` modules and applications where the remote version is not greater than the local version.
5. **Return:** Returns a `Vec<UpdateInfo>` containing only the applications that have updates available.

**Data Structures:**

```rust
pub struct UpdateInfo {
    pub app_id: String,
    pub name: String,
    pub version: String, // New version
    pub current_version: String,
    pub description: String,
    pub icon: String,
    pub arch: String,
    pub category_name: Option<String>,
}
```

**Implementation Details:**

- **File:** `src-tauri/src/services/linglong.rs`
- **Command Registration:** `src-tauri/src/lib.rs`

### Frontend (React/TypeScript)

**API:** `checkForUpdates`

**Responsibility:**

1. **Invoke Command:** Calls the `check_for_updates` Tauri command.
2. **State Management:** Updates the application store (e.g., `updateItemsStore`) with the returned list of updatable applications.
3. **UI:** Renders the update cards based on the store data.

**Implementation Details:**

- **API Definition:** `src/apis/invoke/index.ts`
- **Types:** `src/apis/invoke/types.ts`

## Benefits

1. **Performance:** Reduces IPC overhead by consolidating multiple calls into a single command.
2. **Maintainability:** Business logic (version comparison, CLI parsing) is encapsulated in the Rust backend, keeping the frontend focused on UI.
3. **Type Safety:** Rust structs and TypeScript interfaces ensure type safety across the boundary.
4. **Extensibility:** Easier to implement parallel searching or caching in the backend without changing the frontend interface.

## Future Improvements

- **Parallel Execution:** Currently, the backend iterates sequentially. Using `tokio` to run `ll-cli search` in parallel for multiple apps would significantly speed up the check.
- **Caching:** Cache search results to avoid frequent CLI calls if the user navigates away and back.
- **Bulk Update:** Implement a `update_all` command in Rust to handle the bulk update process efficiently.
