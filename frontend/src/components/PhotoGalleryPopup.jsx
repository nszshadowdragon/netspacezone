import React, { useState } from 'react';

export default function PhotoGalleryPopup({
  folders = [],
  photos = [],
  selectedFolderId,
  getGalleryImgSrc,
  onClose,
  onChangeFolder,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onUploadPhoto,
  onImageClick // pass index to parent to open the main viewer
}) {
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [editingFolderId, setEditingFolderId] = useState(null);
  const [editedFolderName, setEditedFolderName] = useState('');

  // Always include All in dropdown
  const allFolders = [{ _id: 'All', name: 'All' }, ...folders.filter(f => f.name !== 'All')];

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      background: 'radial-gradient(ellipse at 60% 25%, #23273aee 0%, #16171e 100%)',
      zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(5px)'
    }}>
      <div style={{
        background: 'linear-gradient(120deg, #191c25 65%, #181a1f 100%)',
        borderRadius: 22, minWidth: 520, maxWidth: 1200,
        width: 'min(98vw, 1050px)', boxShadow: '0 8px 46px #000b',
        padding: 30, position: 'relative', border: '2px solid #292b36'
      }}>
        {/* Close button */}
        <button onClick={onClose} style={{
          position: 'absolute', top: 16, right: 22, fontSize: 28, color: '#ffe066',
          background: 'rgba(40,35,45,0.7)', border: 'none', cursor: 'pointer',
          zIndex: 8, fontWeight: 'bold', borderRadius: '50%', boxShadow: '0 2px 10px #0008',
          width: 44, height: 44, lineHeight: '40px', textAlign: 'center', transition: 'background 0.17s',
        }}>✕</button>
        
        {/* Folder controls and upload */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24, flexWrap: 'wrap'
        }}>
          {/* Folder selector */}
          <select
            value={selectedFolderId || 'All'}
            onChange={e => onChangeFolder(e.target.value)}
            style={{
              fontSize: 17, borderRadius: 7, border: '1.5px solid #ffe066',
              padding: '7px 14px', background: '#23273a', color: '#ffe066', fontWeight: 700
            }}
          >
            {allFolders.map(folder => (
              <option key={folder._id} value={folder._id}>{folder.name}</option>
            ))}
          </select>

          {/* Create folder */}
          {creatingFolder ? (
            <>
              <input
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                placeholder="Folder name"
                style={{
                  fontSize: 16, borderRadius: 5, border: '1px solid #ffe066', padding: '5px 10px'
                }}
                autoFocus
              />
              <button
                style={{
                  background: '#ffe066', color: '#23273a', fontWeight: 700, border: 'none',
                  borderRadius: 5, padding: '5px 12px', fontSize: 15, cursor: 'pointer'
                }}
                onClick={() => {
                  if (newFolderName.trim()) {
                    onCreateFolder(newFolderName.trim());
                    setNewFolderName('');
                    setCreatingFolder(false);
                  }
                }}
              >Save</button>
              <button
                style={{ background: '#222', color: '#ffe066', borderRadius: 5, border: 'none', padding: '5px 10px', cursor: 'pointer', marginLeft: 4 }}
                onClick={() => setCreatingFolder(false)}
              >Cancel</button>
            </>
          ) : (
            <button
              style={{
                background: '#ffe066', color: '#23273a', fontWeight: 700, border: 'none',
                borderRadius: 5, padding: '7px 16px', fontSize: 15, cursor: 'pointer'
              }}
              onClick={() => setCreatingFolder(true)}
            >+ Create Folder</button>
          )}

          {/* Only show rename/delete for non-All folders */}
          {(selectedFolderId && selectedFolderId !== 'All') && (
            editingFolderId === selectedFolderId ? (
              <>
                <input
                  value={editedFolderName}
                  onChange={e => setEditedFolderName(e.target.value)}
                  style={{
                    fontSize: 16, borderRadius: 5, border: '1px solid #ffe066', padding: '5px 10px'
                  }}
                />
                <button
                  style={{ background: '#ffe066', color: '#23273a', borderRadius: 5, border: 'none', padding: '5px 10px', marginLeft: 4 }}
                  onClick={() => {
                    if (editedFolderName.trim()) {
                      onRenameFolder(selectedFolderId, editedFolderName.trim());
                      setEditingFolderId(null);
                      setEditedFolderName('');
                    }
                  }}
                >Save</button>
                <button
                  style={{ background: '#222', color: '#ffe066', borderRadius: 5, border: 'none', padding: '5px 10px', marginLeft: 4 }}
                  onClick={() => setEditingFolderId(null)}
                >Cancel</button>
              </>
            ) : (
              <>
                <button
                  style={{ background: '#ffe066', color: '#23273a', borderRadius: 5, border: 'none', padding: '7px 14px', fontSize: 15, marginLeft: 6 }}
                  onClick={() => {
                    setEditingFolderId(selectedFolderId);
                    const sel = allFolders.find(f => f._id === selectedFolderId);
                    setEditedFolderName(sel?.name || '');
                  }}
                >Rename</button>
                <button
                  style={{ background: '#ff637a', color: '#fff', borderRadius: 5, border: 'none', padding: '7px 14px', fontSize: 15, marginLeft: 4 }}
                  onClick={() => {
                    if (window.confirm('Delete this folder and all its photos?')) {
                      onDeleteFolder(selectedFolderId);
                    }
                  }}
                >Delete</button>
              </>
            )
          )}

          {/* Upload photo - placed next to other buttons */}
          <button style={{
            background: '#1de9b6', color: '#23273a', borderRadius: 9, border: 'none',
            fontWeight: 700, fontSize: 16, padding: '10px 24px', marginLeft: 12, display: 'inline-block'
          }}
            onClick={() => onUploadPhoto && onUploadPhoto(selectedFolderId)}
          >Upload Photo</button>
        </div>

        {/* Main images grid area */}
        <div style={{
          background: 'rgba(25,26,32,0.97)',
          borderRadius: 18,
          minHeight: 180,
          padding: '25px 18px 18px 18px',
          marginBottom: 10,
          boxShadow: '0 2px 14px #0006',
          border: '1.5px solid #272c39',
        }}>
          {photos.length === 0 ? (
            <div style={{ color: '#bbb', fontSize: 17, textAlign: 'center', padding: 45 }}>
              No photos in this folder.
            </div>
          ) : (
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '17px',
              justifyContent: 'flex-start',
              alignItems: 'flex-start'
            }}>
              {photos.map((photo, idx) => (
                <img
                  key={photo._id || photo.filename || photo.path || photo.url}
                  src={getGalleryImgSrc(photo)}
                  alt=""
                  style={{
                    width: 106,
                    height: 106,
                    objectFit: 'cover',
                    borderRadius: 11,
                    boxShadow: '0 2px 13px #0004',
                    background: '#181a22',
                    cursor: 'pointer',
                    transition: 'box-shadow .16s, transform .10s',
                  }}
                  onClick={() => onImageClick && onImageClick(idx)}
                  tabIndex={0}
                  onKeyDown={e => { if (e.key === 'Enter') onImageClick && onImageClick(idx); }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
