/*
* Pokemon Showdown
* Custom Avatars
* @license MIT
*/

import { FS } from '../../lib';
import { MongoDB } from '../../impulse/mongodb_module';

const STAFF_ROOM_ID = 'staff';

interface AvatarDocument {
  _id: string; // userid
  url: string;
  createdAt: Date;
  updatedAt: Date;
}

// Get typed MongoDB collection for avatars
const AvatarsDB = MongoDB<AvatarDocument>('customavatars');

async function updateAvatars(): Promise<void> {
  try {
    // Fetch all avatar documents from MongoDB
    const avatarDocs = await AvatarsDB.find({});
    
    let newCss = '/* AVATARS START */\n';
    
    for (const doc of avatarDocs) {
      const url = doc.url;
      const userid = doc._id;
      
      newCss += `[username="${userid}"] { background: url("${url}") no-repeat !important; background-size: 80px 80px !important;}\n`;
    }
    
    newCss += '/* AVATARS END */\n';
    
    const file = FS('config/custom.css').readIfExistsSync().split('\n');
    const start = file.indexOf('/* AVATARS START */');
    const end = file.indexOf('/* AVATARS END */');
    
    if (start !== -1 && end !== -1) {
      file.splice(start, (end - start) + 1);
    }
    
    await FS('config/custom.css').writeUpdate(() => file.join('\n') + newCss);
    Impulse.reloadCSS();
  } catch (err) {
    console.error('Error updating avatars:', err);
  }
}

export const commands: Chat.ChatCommands = {
  customavatar: 'avatar',
  avatar: {
    ''(target, room, user) {
      this.parse(`/avatarhelp`);
    },
    
    async set(target, room, user) {
      this.checkCan('globalban');
      const parts = target.split(',').map(s => s.trim());
      const [name, imageUrl] = parts;
      
      if (!name || !imageUrl) return this.parse('/help avatar');
      
      const userId = toID(name);
      if (userId.length > 19) return this.errorReply('Usernames are not this long...');
      
      // Use exists() - most efficient way to check existence
      if (await AvatarsDB.exists({ _id: userId })) {
        return this.errorReply('This user already has a custom avatar. Remove it first with /customavatar delete [user].');
      }
      
      const now = new Date();
      
      // Use insertOne() for single document insert
      await AvatarsDB.insertOne({
        _id: userId,
        url: imageUrl,
        createdAt: now,
        updatedAt: now,
      } as any);
      
      await updateAvatars();
      
      this.sendReply(`|raw|You have given ${Impulse.nameColor(name, true, true)} a custom avatar.`);
      
      const targetUser = Users.get(userId);
      if (targetUser?.connected) {
        targetUser.popup(`|html|${Impulse.nameColor(user.name, true, true)} has set your custom avatar to: <img src="${imageUrl}" width="80" height="80"><br /><center>Refresh, If you don't see it.</center>`);
      }
      
      const staffRoom = Rooms.get(STAFF_ROOM_ID);
      if (staffRoom) {
        staffRoom.add(`|html|<div class="infobox"> ${Impulse.nameColor(user.name, true, true)} set custom avatar for ${Impulse.nameColor(name, true, true)}: <img src="${imageUrl}" width="80" height="80"></div>`).update();
      }
    },
    
    async update(target, room, user) {
      this.checkCan('globalban');
      const parts = target.split(',').map(s => s.trim());
      const [name, imageUrl] = parts;
      
      if (!name || !imageUrl) return this.parse('/help avatar');
      
      const userId = toID(name);
      
      // Use findById() - most efficient for _id lookups
      const existingAvatar = await AvatarsDB.findById(userId);
      if (!existingAvatar) {
        return this.errorReply('This user does not have a custom avatar. Use /customavatar set to create one.');
      }
      
      // Build update object
      const updateFields: Partial<AvatarDocument> = {
        url: imageUrl,
        updatedAt: new Date(),
      };
      
      // Use updateOne() with $set operator
      await AvatarsDB.updateOne(
        { _id: userId },
        { $set: updateFields }
      );
      
      await updateAvatars();
      
      this.sendReply(`|raw|You have updated ${Impulse.nameColor(name, true, true)}'s custom avatar.`);
      
      const targetUser = Users.get(userId);
      if (targetUser?.connected) {
        targetUser.popup(`|html|${Impulse.nameColor(user.name, true, true)} has updated your custom avatar: <img src="${imageUrl}" width="80" height="80"><br /><center>Refresh, If you don't see it.</center>`);
      }
      
      const staffRoom = Rooms.get(STAFF_ROOM_ID);
      if (staffRoom) {
        staffRoom.add(`|html|<div class="infobox"> ${Impulse.nameColor(user.name, true, true)} updated custom avatar for ${Impulse.nameColor(name, true, true)}: <img src="${imageUrl}" width="80" height="80"></div>`).update();
      }
    },
    
    async delete(target, room, user) {
      this.checkCan('globalban');
      const userId = toID(target);
      
      // Use exists() for efficient check before delete
      if (!await AvatarsDB.exists({ _id: userId })) {
        return this.errorReply(`${target} does not have a custom avatar.`);
      }
      
      // Use deleteOne() for single document deletion
      await AvatarsDB.deleteOne({ _id: userId });
      await updateAvatars();
      
      this.sendReply(`You removed ${target}'s custom avatar.`);
      
      const targetUser = Users.get(userId);
      if (targetUser?.connected) {
        targetUser.popup(`|html|${Impulse.nameColor(user.name, true, true)} has removed your custom avatar.`);
      }
      
      const staffRoom = Rooms.get(STAFF_ROOM_ID);
      if (staffRoom) {
        staffRoom.add(`|html|<div class="infobox">${Impulse.nameColor(user.name, true, true)} removed custom avatar for ${Impulse.nameColor(target, true, true)}.</div>`).update();
      }
    },
    
    async list(target, room, user) {
      this.checkCan('globalban');
      
      const page = parseInt(target) || 1;
      
      // Use findWithPagination() - optimized for paginated results
      const result = await AvatarsDB.findWithPagination({}, {
        page,
        limit: 20,
        sort: { _id: 1 }
      });
      
      if (result.total === 0) {
        return this.sendReply('No custom avatars have been set.');
      }
      
      let output = `<div class="ladder pad"><h2>Custom Avatars (Page ${result.page}/${result.pages})</h2><table style="width: 100%"><tr><th>User</th><th>Avatar</th><th>Created</th></tr>`;
      
      for (const avatar of result.data) {
        const created = avatar.createdAt ? avatar.createdAt.toLocaleDateString() : 'Unknown';
        output += `<tr><td>${Impulse.nameColor(avatar._id, true, true)}</td><td><img src="${avatar.url}" width="80" height="80"></td><td>${created}</td></tr>`;
      }
      
      output += `</table></div>`;
      
      if (result.pages > 1) {
        output += `<div class="pad"><center>`;
        if (result.page > 1) {
          output += `<button class="button" name="send" value="/customavatar list ${result.page - 1}">Previous</button> `;
        }
        if (result.page < result.pages) {
          output += `<button class="button" name="send" value="/customavatar list ${result.page + 1}">Next</button>`;
        }
        output += `</center></div>`;
      }
      
      this.sendReply(`|raw|${output}`);
    },
    
    async view(target, room, user) {
      const userId = toID(target);
      if (!userId) return this.parse('/help avatar');
      
      // Use findById() - most efficient for _id lookups
      const avatar = await AvatarsDB.findById(userId);
      if (!avatar) {
        return this.sendReply(`${target} does not have a custom avatar.`);
      }
      
      const created = avatar.createdAt ? avatar.createdAt.toLocaleString() : 'Unknown';
      const updated = avatar.updatedAt ? avatar.updatedAt.toLocaleString() : 'Unknown';
      
      this.sendReplyBox(
        `<strong>Custom Avatar for ${target}:</strong><br />` +
        `<img src="${avatar.url}" width="80" height="80"><br />` +
        `<strong>URL:</strong> ${avatar.url}<br />` +
        `<strong>Created:</strong> ${created}<br />` +
        `<strong>Last Updated:</strong> ${updated}`
      );
    },
    
    async setmany(target, room, user) {
      this.checkCan('globalban');
      
      // Parse bulk input: userid1:url1, userid2:url2, ...
      const entries = target.split(',').map(s => s.trim()).filter(Boolean);
      if (entries.length === 0) return this.errorReply('No avatars to set. Format: /customavatar setmany user1:url1, user2:url2');
      
      const documents: any[] = [];
      const now = new Date();
      
      for (const entry of entries) {
        const [name, url] = entry.split(':').map(s => s.trim());
        if (!name || !url) continue;
        
        const userId = toID(name);
        if (userId.length > 19) continue;
        
        documents.push({
          _id: userId,
          url,
          createdAt: now,
          updatedAt: now,
        });
      }
      
      if (documents.length === 0) {
        return this.errorReply('No valid avatars to set.');
      }
      
      // Use insertMany() for bulk inserts - much more efficient than multiple insertOne()
      try {
        await AvatarsDB.insertMany(documents);
        await updateAvatars();
        this.sendReply(`|raw|Successfully set ${documents.length} custom avatar(s).`);
        
        const staffRoom = Rooms.get(STAFF_ROOM_ID);
        if (staffRoom) {
          staffRoom.add(`|html|<div class="infobox">${Impulse.nameColor(user.name, true, true)} bulk set ${documents.length} custom avatars.</div>`).update();
        }
      } catch (err) {
        this.errorReply(`Error setting avatars: ${err}`);
      }
    },
    
    async search(target, room, user) {
      this.checkCan('globalban');
      
      if (!target) return this.errorReply('Please provide a search term.');
      
      const searchTerm = toID(target);
      
      // Use find() with regex filter for searching
      const avatars = await AvatarsDB.find({
        _id: { $regex: searchTerm, $options: 'i' } as any
      });
      
      if (avatars.length === 0) {
        return this.sendReply(`No custom avatars found matching "${target}".`);
      }
      
      let output = `<div class="ladder pad"><h2>Search Results for "${target}"</h2><table style="width: 100%"><tr><th>User</th><th>Avatar</th></tr>`;
      
      for (const avatar of avatars) {
        output += `<tr><td>${Impulse.nameColor(avatar._id, true, true)}</td><td><img src="${avatar.url}" width="80" height="80"></td></tr>`;
      }
      
      output += `</table></div>`;
      this.sendReply(`|raw|${output}`);
    },
    
    async count(target, room, user) {
      this.checkCan('globalban');
      
      // Use count() - most efficient way to get document count
      const total = await AvatarsDB.count({});
      this.sendReply(`There are currently ${total} custom avatar(s) set.`);
    },
  },
  
  avatarhelp(target, room, user) {
    if (!this.runBroadcast()) return;
    this.sendReplyBox(
      `<div><b><center>Custom Avatar Commands</center></b><br>` +
      `<ul>` +
      `<li><code>/customavatar set [username], [image url]</code> - Gives [user] a custom avatar (Requires: ~)</li>` +
      `<li><code>/customavatar update [username], [image url]</code> - Updates an existing custom avatar's URL (Requires: ~)</li>` +
      `<li><code>/customavatar delete [username]</code> - Removes a user's custom avatar (Requires: ~)</li>` +
      `<li><code>/customavatar setmany [user1:url1, user2:url2, ...]</code> - Bulk set multiple custom avatars (Requires: ~)</li>` +
      `<li><code>/customavatar list [page]</code> - Lists all custom avatars with pagination (Requires: ~)</li>` +
      `<li><code>/customavatar view [username]</code> - View details about a user's custom avatar</li>` +
      `<li><code>/customavatar search [term]</code> - Search for custom avatars by username (Requires: ~)</li>` +
      `<li><code>/customavatar count</code> - Show total number of custom avatars (Requires: ~)</li>` +
      `</ul>` +
      `</div>`
    );
  },
};
