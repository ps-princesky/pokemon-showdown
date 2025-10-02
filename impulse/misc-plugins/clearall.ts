/*
* Pokemon Showdown
* Clearall
* @license MIT
*/

function clearRooms(rooms: Room[], user: User): string[] {
  const clearedRooms: string[] = [];
  for (const room of rooms) {
    if (!room) continue;
    if (room.log.log) {
      room.log.log.length = 0;
    }
    const userIds = Object.keys(room.users) as ID[];
    for (const userId of userIds) {
      const userObj = Users.get(userId);
      if (userObj?.connections?.length) {
        for (const connection of userObj.connections) {
          userObj.leaveRoom(room, connection);
        }
      }
    }
    
    clearedRooms.push(room.id);
    setTimeout(() => {
      for (const userId of userIds) {
        const userObj = Users.get(userId);
        if (userObj?.connections?.length) {
          for (const connection of userObj.connections) {
            userObj.joinRoom(room, connection);
          }
        }
      }
    }, 1000);
  }
  return clearedRooms;
}

export const commands: Chat.ChatCommands = {
  clearall(target, room, user) {
    if (room?.battle) {
      return this.sendReply("You cannot clearall in battle rooms.");
    }
    if (!room) {
      return this.errorReply("This command requires a room.");
    }
    this.checkCan('roommod', null, room);
    clearRooms([room], user);
  },

  globalclearall(target, room, user) {
    this.checkCan('bypassall');

    const roomsToClear = Rooms.global.chatRooms.filter((chatRoom): chatRoom is Room => !!chatRoom && !chatRoom.battle);
    const clearedRooms = clearRooms(roomsToClear, user);
  },

  clearallhelp(target, room, user) {
    if (!this.runBroadcast()) return;
    this.sendReplyBox(
      `<div><b><center>Clearall Commands</center></b><br>` +
      `<ul>` +
      `<li><code>/clearall</code> - Clear all messages from a chatroom</li>` +
      `<li><code>/globalclearall</code> - Clear all messages from all chatrooms</li>` +
      `</ul>` +
      `<small>/clearall requires # or higher permission. /globalclearall requires ~ permission.</small>` +
      `</div>`
    );
  },
};
