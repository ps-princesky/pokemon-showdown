/*
* Pokemon Showdown
* File Management
* @license MIT
* Instructions:
* - Obtain a GitHub "personal access token" with the "gist" permission.
* - Set this token as Config.githubToken in your configuration.
* - These commands are restricted to console/owner accounts for security.
*/

import * as https from "https";
import { FS } from "../../lib";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);
const GITHUB_API_URL = "https://api.github.com/gists";
const GITHUB_TOKEN: string | undefined = Config.githubToken;

interface GistResponse {
  id: string;
  html_url: string;
}

function notifyStaff(action: string, file: string, user: User, info = "") {
  const staffRoom = Rooms.get("staff");
  if (!staffRoom) return;

  const safeFile = Chat.escapeHTML(file);
  const safeUser = Chat.escapeHTML(user.id);

  const message =
    '<div class="infobox">' +
    '<strong>[FILE MANAGEMENT]</strong> ' + action + '<br>' +
    '<strong>File:</strong> ' + safeFile + '<br>' +
    '<strong>User:</strong> <username>' + safeUser + '</username><br>' +
    (info ? Chat.escapeHTML(info) : '') +
    '</div>';

  staffRoom.addRaw(message).update();
}

function notifyUserBox(
  context: Chat.CommandContext,
  action: string,
  file: string,
  user: User,
  link = "",
  info = ""
) {
  const safeFile = Chat.escapeHTML(file);
  const safeUser = Chat.escapeHTML(user.id);

  const message =
    '<div class="infobox">' +
    '<strong>[FILE MANAGEMENT]</strong> ' + action + '<br>' +
    '<strong>File:</strong> ' + safeFile + '<br>' +
    '<strong>User:</strong> <username>' + safeUser + '</username>' +
    (link ? '<br><strong>Source:</strong> ' + Chat.escapeHTML(link) : '') +
    (info ? '<br>' + Chat.escapeHTML(info) : '') +
    '</div>';

  context.sendReplyBox(message);
}

async function githubRequest<T>(
  method: "POST" | "PATCH",
  path: string,
  data: Record<string, any>
): Promise<T> {
  if (!GITHUB_TOKEN) {
    throw new Error("GitHub token not configured in Config.githubToken");
  }

  const postData = JSON.stringify(data);

  const options: https.RequestOptions = {
    hostname: "api.github.com",
    path,
    method,
    headers: {
      "User-Agent": Config.serverid || "PS-FileManager",
      Authorization: "Bearer " + GITHUB_TOKEN,
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(postData),
    },
  };

  return new Promise<T>((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        if (!res.statusCode || res.statusCode >= 400) {
          return reject(
            new Error("GitHub API error " + res.statusCode + ": " + body)
          );
        }
        try {
          resolve(JSON.parse(body));
        } catch {
          reject(new Error("Failed to parse GitHub API response"));
        }
      });
    });

    req.on("error", reject);
    req.write(postData);
    req.end();
  });
}

function fetchFromGistRaw(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      if (res.statusCode !== 200) {
        return reject(new Error("Failed to fetch gist (HTTP " + res.statusCode + ")"));
      }
      let data = "";
      res.on("data", chunk => (data += chunk));
      res.on("end", () => resolve(data));
    }).on("error", reject);
  });
}

function validateGistRawURL(url: string): void {
  const allowedPrefixes = [
    "https://gist.githubusercontent.com/",
    "https://raw.githubusercontent.com/"
  ];
  
  const isAllowed = allowedPrefixes.some(prefix => url.startsWith(prefix));
  
  if (!isAllowed) {
    throw new Error("Invalid URL. Only raw URLs from gist.githubusercontent.com or raw.githubusercontent.com are allowed.");
  }
}

async function findGitRoot(startPath: string): Promise<string | null> {
  const path = require('path');
  let currentPath = path.resolve(startPath);
  const maxLevels = 10; // Safety limit to prevent infinite loops
  
  for (let i = 0; i < maxLevels; i++) {
    const gitPath = path.join(currentPath, '.git');
    try {
      const exists = await FS(gitPath).isDirectory();
      if (exists) return currentPath;
    } catch {
      // Directory doesn't exist, continue searching
    }
    
    // Go up one level
    const parentPath = path.dirname(currentPath);
    
    // Check if we've reached the filesystem root
    if (parentPath === currentPath) break;
    
    currentPath = parentPath;
  }
  
  return null;
}

class FileManager {
  static async uploadToGist(
    content: string,
    filePath: string,
    description = "Uploaded via bot"
  ): Promise<string> {
    const baseFilename = filePath.split("/").pop()!;
    const response = await githubRequest<GistResponse>("POST", "/gists", {
      description,
      public: false,
      files: {
        [baseFilename]: { content },
      },
    });
    return response.html_url;
  }

  static async readFile(filePath: string): Promise<string> {
    return FS(filePath).readIfExists();
  }

  static async writeFile(filePath: string, data: string): Promise<void> {
    await FS(filePath).write(data);
  }

  static async deleteFile(filePath: string): Promise<void> {
    await FS(filePath).unlinkIfExists();
  }
}

export const commands: Chat.ChatCommands = {
  async fileupload(target, room, user) {
    this.runBroadcast();
    this.canUseConsole();
    const filePath = target.trim();
    const fileContent = await FileManager.readFile(filePath);

    if (!fileContent) return this.errorReply("File not found: " + filePath);

    try {
      const url = await FileManager.uploadToGist(
        fileContent,
        filePath,
        "Uploaded by " + user.name
      );
      notifyUserBox(this, "Uploaded file", filePath, user, url);
      notifyStaff("Uploaded file", filePath, user);
    } catch (err: any) {
      this.errorReply("Upload failed: " + err.message);
      notifyUserBox(this, "Upload failed", filePath, user, "", err.message);
      notifyStaff("Upload failed", filePath, user, err.message);
    }
  },
  fu: 'fileupload',

  async fileread(target, room, user) {
    this.runBroadcast();
    this.canUseConsole();
    const filePath = target.trim();

    try {
      const content = await FileManager.readFile(filePath);
      if (!content) return this.errorReply("File not found: " + filePath);

      this.sendReplyBox(
        "<b>Contents of " + Chat.escapeHTML(filePath) + ":</b><br>" +
        "<details><summary>Show/Hide File</summary>" +
        "<div style=\"max-height:320px; overflow:auto;\"><pre>" +
          Chat.escapeHTML(content) +
        "</pre></div></details>"
      );
    } catch (err: any) {
      this.errorReply("Error reading file: " + err.message);
    }
  },
  fr: 'fileread',

  async filesave(target, room, user) {
    this.runBroadcast();
    this.canUseConsole();

    const [path, url] = target.split(",").map(p => p.trim());
    if (!path || !url) {
      return this.errorReply("Usage: /filesave path, raw-gist-url");
    }

    try {
      validateGistRawURL(url);
      const content = await fetchFromGistRaw(url);
      await FileManager.writeFile(path, content);

      notifyUserBox(this, "Saved file from Gist", path, user, url);
      notifyStaff("Saved file from Gist", path, user);
    } catch (err: any) {
      this.errorReply("File save failed: " + err.message);
      notifyUserBox(this, "File save failed", path, user, url, err.message);
      notifyStaff("File save failed", path, user, err.message);
    }
  },
  fs: 'filesave',

  async filedelete(target, room, user) {
    this.runBroadcast();
    this.canUseConsole();

    const [flag, ...pathParts] = target.split(",");
    const confirm = flag.trim().toLowerCase() === "confirm";
    const filePath = pathParts.join(",").trim();

    if (!confirm || !filePath) {
      return this.errorReply(
        "Usage: /filedelete confirm, path\nExample: /filedelete confirm, data/test.txt"
      );
    }

    try {
      await FileManager.deleteFile(filePath);
      notifyUserBox(this, "Deleted file", filePath, user);
      notifyStaff("Deleted file", filePath, user);
    } catch (err: any) {
      this.errorReply("File deletion failed: " + err.message);
      notifyUserBox(this, "File deletion failed", filePath, user, "", err.message);
      notifyStaff("File deletion failed", filePath, user, err.message);
    }
  },
  fd: 'filedelete',
  
  async filelist(target, room, user) {
    this.canUseConsole();
    this.runBroadcast();
    
    const dirPath = target.trim() || './';
    try {
      const entries = await FS(dirPath).readdir();
      if (!entries || entries.length === 0) {
        return this.errorReply("Directory is empty or not found: " + dirPath);
      }
      
      const files: string[] = [];
      const directories: string[] = [];
      
      for (const entry of entries) {
        const fullPath = dirPath + '/' + entry;
        const isDir = await FS(fullPath).isDirectory();
        if (isDir) {
          directories.push(entry);
        } else {
          files.push(entry);
        }
      }
      
      let content = `<b>Contents of ${Chat.escapeHTML(dirPath)}:</b><br>`;

      if (directories.length > 0) {
        content += `<b>Directories (${directories.length}):</b><br>`;
        content += directories.map(dir => `📁 ${Chat.escapeHTML(dir)}`).join('<br>') + '<br><br>';
      }
      
      if (files.length > 0) {
        content += `<b>Files (${files.length}):</b><br>`;
        content += files.map(file => `📄 ${Chat.escapeHTML(file)}`).join('<br>');
      }

      this.sendReplyBox(content);
      notifyStaff("Listed directory", dirPath, user);

    } catch (err: any) {
      this.errorReply("Failed to list directory: " + err.message);
      notifyStaff("Directory listing failed", dirPath, user, err.message);
    }
  },
  fl: 'filelist',

  // GIT INTEGRATION COMMANDS

  async gitpull(target, room, user) {
    this.canUseConsole();
    const repoPath = target.trim() || './';
    
    try {
      // Check if it's a git repository
      const isGitRepo = await FS(repoPath + '/.git').isDirectory();
      if (!isGitRepo) {
        return this.errorReply(`${repoPath} is not a git repository.`);
      }

      this.sendReply('Pulling from remote repository...');
      
      const { stdout, stderr } = await execAsync('git pull', { cwd: repoPath });
      
      let resultMessage = '<div class="infobox">';
      resultMessage += '<strong>[GIT PULL]</strong><br>';
      resultMessage += `<strong>Repository:</strong> ${Chat.escapeHTML(repoPath)}<br>`;
      
      if (stdout) {
        resultMessage += '<strong>Output:</strong><br><pre>' + Chat.escapeHTML(stdout) + '</pre>';
      }
      if (stderr) {
        resultMessage += '<strong>Errors:</strong><br><pre>' + Chat.escapeHTML(stderr) + '</pre>';
      }
      
      resultMessage += '</div>';
      
      this.sendReplyBox(resultMessage);
      notifyStaff("Git pull executed", repoPath, user, stdout.slice(0, 100));
      
    } catch (err: any) {
      this.errorReply('Git pull failed: ' + err.message);
      notifyStaff("Git pull failed", repoPath, user, err.message);
    }
  },

  async gitstatus(target, room, user) {
    this.canUseConsole();
    const repoPath = target.trim() || './';
    
    try {
      // Check if it's a git repository
      const isGitRepo = await FS(repoPath + '/.git').isDirectory();
      if (!isGitRepo) {
        return this.errorReply(`${repoPath} is not a git repository.`);
      }

      // Get git status
      const { stdout: status } = await execAsync('git status', { cwd: repoPath });
      
      // Get current branch
      const { stdout: branch } = await execAsync('git branch --show-current', { cwd: repoPath });
      
      // Get latest commit
      const { stdout: commit } = await execAsync('git log -1 --oneline', { cwd: repoPath });
      
      let resultMessage = '<div class="infobox">';
      resultMessage += '<strong>[GIT STATUS]</strong><br>';
      resultMessage += `<strong>Repository:</strong> ${Chat.escapeHTML(repoPath)}<br>`;
      resultMessage += `<strong>Branch:</strong> ${Chat.escapeHTML(branch.trim())}<br>`;
      resultMessage += `<strong>Latest Commit:</strong> ${Chat.escapeHTML(commit.trim())}<br><br>`;
      resultMessage += '<details><summary><strong>Full Status</strong></summary>';
      resultMessage += '<pre>' + Chat.escapeHTML(status) + '</pre>';
      resultMessage += '</details>';
      resultMessage += '</div>';
      
      this.sendReplyBox(resultMessage);
      notifyStaff("Git status checked", repoPath, user);
      
    } catch (err: any) {
      this.errorReply('Git status failed: ' + err.message);
      notifyStaff("Git status failed", repoPath, user, err.message);
    }
  },

  async gitcommit(target, room, user) {
    this.canUseConsole();
    
    const [repoPath, ...messageParts] = target.split(',');
    const path = repoPath.trim() || './';
    const message = messageParts.join(',').trim();
    
    if (!message) {
      return this.errorReply('Usage: /gitcommit [repository path], [commit message]');
    }
    
    try {
      // Check if it's a git repository
      const isGitRepo = await FS(path + '/.git').isDirectory();
      if (!isGitRepo) {
        return this.errorReply(`${path} is not a git repository.`);
      }

      // Add all changes
      this.sendReply('Staging changes...');
      await execAsync('git add .', { cwd: path });
      
      // Commit changes
      this.sendReply('Committing changes...');
      const { stdout, stderr } = await execAsync(`git commit -m "${message.replace(/"/g, '\\"')}"`, { cwd: path });
      
      let resultMessage = '<div class="infobox">';
      resultMessage += '<strong>[GIT COMMIT]</strong><br>';
      resultMessage += `<strong>Repository:</strong> ${Chat.escapeHTML(path)}<br>`;
      resultMessage += `<strong>Message:</strong> ${Chat.escapeHTML(message)}<br>`;
      resultMessage += `<strong>User:</strong> <username>${user.id}</username><br>`;
      
      if (stdout) {
        resultMessage += '<strong>Output:</strong><br><pre>' + Chat.escapeHTML(stdout) + '</pre>';
      }
      if (stderr) {
        resultMessage += '<strong>Info:</strong><br><pre>' + Chat.escapeHTML(stderr) + '</pre>';
      }
      
      resultMessage += '</div>';
      
      this.sendReplyBox(resultMessage);
      notifyStaff("Git commit created", path, user, `Message: ${message}`);
      
    } catch (err: any) {
      // Check if error is because there's nothing to commit
      if (err.message.includes('nothing to commit')) {
        this.sendReply('Nothing to commit - working tree clean.');
        return;
      }
      this.errorReply('Git commit failed: ' + err.message);
      notifyStaff("Git commit failed", path, user, err.message);
    }
  },

  async gitpush(target, room, user) {
    this.canUseConsole();
    const repoPath = target.trim() || './';
    
    try {
      // Check if it's a git repository
      const isGitRepo = await FS(repoPath + '/.git').isDirectory();
      if (!isGitRepo) {
        return this.errorReply(`${repoPath} is not a git repository.`);
      }

      this.sendReply('Pushing to remote repository...');
      
      const { stdout, stderr } = await execAsync('git push', { cwd: repoPath });
      
      let resultMessage = '<div class="infobox">';
      resultMessage += '<strong>[GIT PUSH]</strong><br>';
      resultMessage += `<strong>Repository:</strong> ${Chat.escapeHTML(repoPath)}<br>`;
      
      if (stdout) {
        resultMessage += '<strong>Output:</strong><br><pre>' + Chat.escapeHTML(stdout) + '</pre>';
      }
      if (stderr) {
        resultMessage += '<strong>Info:</strong><br><pre>' + Chat.escapeHTML(stderr) + '</pre>';
      }
      
      resultMessage += '</div>';
      
      this.sendReplyBox(resultMessage);
      notifyStaff("Git push executed", repoPath, user);
      
    } catch (err: any) {
      this.errorReply('Git push failed: ' + err.message);
      notifyStaff("Git push failed", repoPath, user, err.message);
    }
  },

  githelp(target, room, user) {
    if (!this.runBroadcast()) return;
    this.sendReplyBox(
      `<div><b><center>Git Integration Commands</center></b><br>` +
      `<ul>` +
      `<li><code>/gitpull [repository path]</code> - Pull latest changes from remote repository</li>` +
      `<li><code>/gitstatus [repository path]</code> - Show git status, branch, and latest commit</li>` +
      `<li><code>/gitcommit [repository path], [commit message]</code> - Stage and commit all changes</li>` +
      `<li><code>/gitpush [repository path]</code> - Push commits to remote repository</li>` +
      `</ul>` +
      `<small>All commands require Console/Owner permission.</small><br>` +
      `<small>If no repository path is specified, current directory (./) is used.</small>` +
      `</div>`
    );
  },
  
  fmhelp(target, room, user) {
    if (!this.runBroadcast()) return;
    this.sendReplyBox(
      `<div><b><center>File Management Commands</center></b><br>` +
      `<ul>` +
      `<li><code>/fileupload [path]</code> OR <code>/fu [path]</code> - Upload file to GitHub Gist</li>` +
      `<li><code>/fileread [path]</code> OR <code>/fr [path]</code> - Read file contents</li>` +
      `<li><code>/filesave [path], [raw gist url]</code> OR <code>/fs [path], [raw gist url]</code> - Save/overwrite file</li>` +
      `<li><code>/filedelete confirm, [path]</code> OR <code>/fd confirm, [path]</code> - Delete file</li>` +
      `<li><code>/filelist [directory]</code> OR <code>/fl [directory]</code> - List directory contents</li>` +
      `<li><code>/githelp</code> - View git integration commands</li>` +
      `</ul>` +
      `<small>All commands require Console/Owner permission.</small>` +
      `</div>`
    );
  },
  
  filemanager: 'fmhelp',
};
