import React, { useState, useEffect } from "react";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";

export default function TopFriends({ friends, onReorder, onSwap }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredFriends, setFilteredFriends] = useState(friends);

  useEffect(() => {
    if (searchTerm === "") {
      setFilteredFriends(friends);
    } else {
      setFilteredFriends(
        friends.filter((friend) =>
          friend.name.toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }
  }, [searchTerm, friends]);

  const handleDragEnd = (result) => {
    if (!result.destination) return; // If dropped outside the list
    const reorderedFriends = Array.from(friends);
    const [removed] = reorderedFriends.splice(result.source.index, 1);
    reorderedFriends.splice(result.destination.index, 0, removed);
    onReorder(reorderedFriends);
  };

  return (
    <div className="top-friends">
      <h2>Your Top 10 Friends</h2>
      <input
        type="text"
        placeholder="Search friends..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="search-bar"
      />
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="friends-list">
          {(provided) => (
            <ul
              className="friends-list"
              {...provided.droppableProps}
              ref={provided.innerRef}
            >
              {filteredFriends.map((friend, index) => (
                <Draggable key={friend.id} draggableId={friend.id} index={index}>
                  {(provided) => (
                    <li
                      className="friend-item"
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                    >
                      <img
                        src={friend.avatar}
                        alt={friend.name}
                        className="friend-avatar"
                      />
                      <span className="friend-name">{friend.name}</span>
                    </li>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </ul>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
}
