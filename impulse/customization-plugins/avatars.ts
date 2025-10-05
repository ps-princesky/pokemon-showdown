/*
* Pokemon Showdown
* Custom Avatars
* @license MIT
*/

import { FS } from '../../lib';

const AVATAR_PATH = 'config/avatars/';
const STAFF_ROOM_ID = 'staff';
const VALID_EXTENSIONS = ['.jpg', '.png', '.gif'];

async function downloadImage(imageUrl: string, name: string, extension: string): Promise<void> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) return;

    const contentType = response.headers.get('content-type');
    if (!contentType?.startsWith('image/')) return;
    
    const buffer = await response.arrayBuffer();
    await FS(AVATAR_PATH + name + extension).write(Buffer.from(buffer));
  } catch (err) {
    console.error('Error downloading avatar:', err);
  }
}

function getExtension(filename: string): string {
  const ext = filename.slice(filename.lastIndexOf('.'));
  return ext || '';
}

export const commands: Chat.ChatCommands = {
  customavatar: {
    async set(target, room, user) {
      this.checkCan('bypassall');
      const [name, avatarUrl] = target.split(',').map(s => s.trim());
      if (!name || !avatarUrl) return this.parse('/help customavatar');
      
      const userId = toID(name);
      const processedUrl = /^https?:\/\//i.test(avatarUrl) ? avatarUrl : `http://${avatarUrl}`;
      const ext = getExtension(processedUrl);
      if (!VALID_EXTENSIONS.includes(ext)) {
        return this.errorReply('Image must have .jpg, .png, or .gif extension.');
      }

      // Download the image to config/avatars/
      const avatarFilename = userId + ext;
      await downloadImage(processedUrl, userId, ext);

      // Use the new avatar system API to add the personal avatar
      const avatar = avatarFilename;
      if (!Users.Avatars.addPersonal(userId, avatar)) {
        return this.errorReply(`Failed to set avatar. User may already have this avatar.`);
      }

      // Save the avatars immediately
      Users.Avatars.save(true);

      this.sendReply(`|raw|${name}'s avatar was successfully set. Avatar:<p><img src='${processedUrl}' width='80' height='80'></p>`);
      
      const targetUser = Users.get(userId);
      if (targetUser) {
        targetUser.popup(`|html|${Impulse.nameColor(user.name, true, true)} set your custom avatar.<p><img src='${processedUrl}' width='80' height='80'></p><p>Use <code>/avatars</code> to see your custom avatars!</p>`);
        // Update the user's current avatar
        targetUser.avatar = avatar;
      }
      
      let staffRoom = Rooms.get(STAFF_ROOM_ID);
      if (staffRoom) {
        staffRoom.add(`|html|<div class="infobox"><center><strong>${Impulse.nameColor(user.name, true, true)} set custom avatar for ${Impulse.nameColor(userId, true, false)}:</strong><br><img src='${processedUrl}' width='80' height='80'></center></div>`).update();
      }
    },
    
    async delete(target, room, user) {
      this.checkCan('bypassall');
      const userId = toID(target);
      
      // Check if user has any custom avatars
      const userAvatars = Users.Avatars.avatars[userId];
      if (!userAvatars || !userAvatars.allowed.length) {
        return this.errorReply(`${target} does not have a custom avatar.`);
      }

      // Get the personal avatar (first in the allowed array)
      const personalAvatar = userAvatars.allowed[0];
      if (!personalAvatar) {
        return this.errorReply(`${target} does not have a personal avatar.`);
      }

      try {
        // Delete the physical file
        await FS(AVATAR_PATH + personalAvatar).unlinkIfExists();
        
        // Remove from the avatar system
        Users.Avatars.removeAllowed(userId, personalAvatar);
        Users.Avatars.save(true);
        
        const targetUser = Users.get(userId);
        if (targetUser) {
          targetUser.popup(`|html|${Impulse.nameColor(this.user.name, true, true)} has deleted your custom avatar.`);
          // Reset to default avatar
          targetUser.avatar = 1;
        }
        
        this.sendReply(`${target}'s avatar has been removed.`);
        
        let staffRoom = Rooms.get(STAFF_ROOM_ID);
        if (staffRoom) {
          staffRoom.add(`|html|<div class="infobox"><strong>${Impulse.nameColor(this.user.name, true, true)} deleted custom avatar for ${Impulse.nameColor(userId, true, false)}.</strong></div>`).update(); 
        }
      } catch (err) {
        console.error('Error deleting avatar:', err);
        return this.errorReply('An error occurred while deleting the avatar.');
      }
    },
  },
   
  customavatarhelp(target, room, user) {
    if (!this.runBroadcast()) return;
    this.sendReplyBox(
      `<div><b><center>Custom Avatar Commands</center></b><br>` +
      `<ul>` +
      `<li><code>/customavatar set [username], [image url]</code> - Sets a user's personal avatar (downloads and adds to system)</li>` +
      `<li><code>/customavatar delete [username]</code> - Removes a user's personal avatar</li>` +
      `</ul>` +
      `<small>All commands require ~ or higher permission.</small>` +
      `<br><small>Note: This integrates with the main avatar system. Users can view their avatars with <code>/avatars</code>.</small>` +
      `</div>`
    );
  },	
};
