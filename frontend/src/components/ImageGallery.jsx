import React, { useState, useCallback, useEffect } from 'react';
import { FaChevronLeft, FaChevronRight, FaFolderPlus, FaEdit, FaTrash, FaFolder } from 'react-icons/fa';
import { useDropzone } from 'react-dropzone';
import Cropper from 'react-easy-crop';
import getCroppedImg from '../utils/cropImageUtil';
import { toast } from 'react-toastify';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
// REPLACE the import of apiFetch with the local function below
// import apiFetch from '../utils/apiFetch';
import ImagePopupViewer from './ImagePopupViewer';

// Use this apiFetch for ALL backend calls in this file:
async function apiFetch(url, options = {}) {
  const mergedOptions = {
    ...options,
    credentials: 'include'
  };
  return fetch(url, mergedOptions);
}

const cardStyle = {
  background: '#111',
  borderRadius: '18px',
  boxShadow: '0 4px 24px 0 rgba(0,0,0,0.30)',
  padding: '2rem',
  marginBottom: '2rem',
  border: '1.5px solid #353535',
};
const sectionTitle = {
  fontSize: '1.25rem',
  marginBottom: '1.2rem',
  fontWeight: 800,
  color: '#ffe066',
  letterSpacing: 1,
};

function reorder(list, startIndex, endIndex) {
  const result = Array.from(list);
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);
  return result;
}

export default function ImageGallery({ user }) {
  const [galleryImages, setGalleryImages] = useState([]);
  const [showAllGallery, setShowAllGallery] = useState(false);
  const [showMoreGallery, setShowMoreGallery] = useState(false);
  const [folders, setFolders] = useState(['All']);
  const [selectedFolder, setSelectedFolder] = useState('All');
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [popupIndex, setPopupIndex] = useState(null);

  const [multiUploadFiles, setMultiUploadFiles] = useState([]);
  const [multiUploadIdx, setMultiUploadIdx] = useState(0);
  const [showUploadPreview, setShowUploadPreview] = useState(false);

  const [showCropper, setShowCropper] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [uploading, setUploading] = useState(false);

  // Edit caption state for popup
  const [isEditingCaption, setIsEditingCaption] = useState(false);
  const [captionInput, setCaptionInput] = useState('');

  // ---------- Per-account Backend Fetches (critical) ----------
  // user._id should be the profile owner's id (not viewer's id unless it's their own profile!)
  const accountId = user && user._id ? user._id : '';

  async function refreshGalleryAndFolders() {
    if (!accountId) return;
    try {
      // Fetch images for the specified user
      const res = await apiFetch(`http://localhost:5000/api/gallery?accountId=${accountId}`);
      const imgs = await res.json();
      setGalleryImages((imgs || []).map(img => ({ ...img, folder: img.folder || 'All' })));
      // Fetch folders for the specified user
      const resFolders = await apiFetch(`http://localhost:5000/api/gallery/folders?accountId=${accountId}`);
      const foldersData = await resFolders.json();
      if (foldersData && foldersData.length) setFolders(['All', ...foldersData.filter(f => f !== 'All')]);
    } catch (err) {
      toast.error('Could not load gallery or folders!');
    }
  }

  useEffect(() => {
    refreshGalleryAndFolders();
    // Re-load when user (profile owner) changes
    // eslint-disable-next-line
  }, [accountId]);

  // ----------- Helper Functions -------------
  function getGalleryImgSrc(path) {
    if (!path) return '';
    if (typeof path === 'object' && path.path) path = path.path;
    if (path.startsWith('http')) return path;
    if (path.startsWith('/uploads')) return 'http://localhost:5000' + path;
    if (path.startsWith('/')) return path;
    return '/' + path;
  }
  function filterImagesByFolder(imgs) {
    return selectedFolder === 'All' ? imgs : imgs.filter(img => img.folder === selectedFolder);
  }
  const maxGalleryToShow = showMoreGallery ? 12 : 8;
  const visibleImages = filterImagesByFolder(
    showAllGallery
      ? galleryImages
      : galleryImages.slice(0, maxGalleryToShow)
  );
  const popupImages = filterImagesByFolder(galleryImages);

  // ----------- Upload logic (multi) -------------
  const onDrop = useCallback((acceptedFiles) => {
    if (!acceptedFiles?.length) return;
    setMultiUploadFiles(
      acceptedFiles.map(f => ({
        file: f,
        preview: URL.createObjectURL(f),
        croppedBlob: null,
      }))
    );
    setMultiUploadIdx(0);
    setShowUploadPreview(true);
    setShowCropper(false);
    setZoom(1);
    setCrop({ x: 0, y: 0 });
    setCroppedAreaPixels(null);
  }, []);
  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    multiple: true,
    disabled: !user || !user._id, // Disable upload if not on a valid user profile
  });

  const onCropComplete = useCallback((_, croppedPixels) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  async function handleSaveCrop() {
    const idx = multiUploadIdx;
    const uploadPreview = multiUploadFiles[idx].preview;
    const file = multiUploadFiles[idx].file;
    if (uploadPreview && croppedAreaPixels) {
      const croppedBlob = await getCroppedImg(uploadPreview, croppedAreaPixels);
      const croppedFile = new File([croppedBlob], file.name, { type: file.type });
      const newFiles = [...multiUploadFiles];
      newFiles[idx] = {
        ...newFiles[idx],
        file: croppedFile,
        preview: URL.createObjectURL(croppedBlob),
        croppedBlob,
      };
      setMultiUploadFiles(newFiles);
      setShowCropper(false);
    }
  }
  function handleCancelCrop() {
    setShowCropper(false);
  }
  function handleRemoveUpload() {
    const nextFiles = multiUploadFiles.filter((_, i) => i !== multiUploadIdx);
    if (nextFiles.length) {
      setMultiUploadFiles(nextFiles);
      setMultiUploadIdx(Math.max(0, multiUploadIdx - 1));
    } else {
      setShowUploadPreview(false);
      setMultiUploadFiles([]);
      setMultiUploadIdx(0);
    }
    setShowCropper(false);
    setZoom(1);
    setCrop({ x: 0, y: 0 });
    setCroppedAreaPixels(null);
    setUploading(false);
  }
  async function handleUploadSave() {
    setUploading(true);
    let anySuccess = false;
    for (const imgObj of multiUploadFiles) {
      const form = new FormData();
      form.append('image', imgObj.file);
      form.append('folder', selectedFolder);
      form.append('accountId', accountId); // <--- ensure upload is tied to this account!
      try {
        const res = await apiFetch('http://localhost:5000/api/gallery', {
          method: 'POST',
          body: form
        });
        const data = await res.json();
        if (data && (data.path || data.filename)) {
          setGalleryImages(prev => [
            { path: data.path || '/uploads/' + data.filename, folder: selectedFolder },
            ...prev
          ]);
          anySuccess = true;
        }
      } catch {}
    }
    setShowUploadPreview(false);
    setMultiUploadFiles([]);
    setMultiUploadIdx(0);
    setShowCropper(false);
    setZoom(1);
    setCrop({ x: 0, y: 0 });
    setUploading(false);
    await refreshGalleryAndFolders();
    if (anySuccess) toast.success('Images uploaded!');
    else toast.error('Upload failed.');
  }

  // ----------- Folder CRUD (fully persistent per-user) -------------
  async function handleCreateFolder() {
    let newFolder = prompt('Enter folder name:');
    if (!newFolder) return;
    try {
      const res = await apiFetch('http://localhost:5000/api/gallery/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newFolder, accountId }),
      });
      if (res.status === 409) {
        toast.error('Folder already exists.');
        return;
      }
      if (!res.ok) throw new Error();
      toast.success(`Folder "${newFolder}" created.`);
      await refreshGalleryAndFolders();
    } catch {
      toast.error('Failed to create folder.');
    }
  }
  async function handleRenameFolder(idx) {
    let oldName = folders[idx];
    let newName = prompt('Rename folder:', oldName);
    if (!newName || newName === oldName) return;
    try {
      const res = await apiFetch(`http://localhost:5000/api/gallery/folders/${encodeURIComponent(oldName)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newName, accountId }),
      });
      if (!res.ok) throw new Error();
      toast.success(`Renamed to "${newName}".`);
      await refreshGalleryAndFolders();
      if (selectedFolder === oldName) setSelectedFolder(newName);
    } catch {
      toast.error('Failed to rename folder.');
    }
  }
  async function handleDeleteFolder(idx) {
    let name = folders[idx];
    if (name === 'All') return;
    if (!window.confirm(`Delete folder "${name}"? Images will move to All.`)) return;
    try {
      const res = await apiFetch(`http://localhost:5000/api/gallery/folders/${encodeURIComponent(name)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId }),
      });
      if (!res.ok) throw new Error();
      toast.success(`Deleted "${name}".`);
      await refreshGalleryAndFolders();
      if (selectedFolder === name) setSelectedFolder('All');
    } catch {
      toast.error('Failed to delete folder.');
    }
  }
  async function handleMoveImageToFolder(imgIdx, folderName) {
    const img = galleryImages[imgIdx];
    setGalleryImages(prev => prev.map((img, i) => i === imgIdx ? { ...img, folder: folderName } : img));
    toast.success(`Image moved to "${folderName}".`);
    await apiFetch(`http://localhost:5000/api/gallery/${img.filename}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder: folderName, accountId }),
    });
    await refreshGalleryAndFolders();
  }

  // ----------- Drag & drop -------------
  function onDragEnd(result) {
    if (!result.destination) return;
    const reordered = reorder(visibleImages, result.source.index, result.destination.index);
    if (selectedFolder === 'All') {
      setGalleryImages(reordered.concat(galleryImages.slice(visibleImages.length)));
    } else {
      let reorderedIdx = 0;
      setGalleryImages(prev =>
        prev.map(img =>
          img.folder === selectedFolder ? reordered[reorderedIdx++] : img
        )
      );
    }
    // TODO: PATCH backend to persist order
  }

  // ----------- Popup Viewer Modal integration -------------
  function prevPopupImg(images) {
    setIsEditingCaption(false);
    setPopupIndex((popupIndex - 1 + images.length) % images.length);
    setCaptionInput(images[(popupIndex - 1 + images.length) % images.length]?.caption || '');
  }
  function nextPopupImg(images) {
    setIsEditingCaption(false);
    setPopupIndex((popupIndex + 1) % images.length);
    setCaptionInput(images[(popupIndex + 1) % images.length]?.caption || '');
  }
  async function deleteImage() {
    const img = popupImages[popupIndex];
    try {
      await apiFetch(`http://localhost:5000/api/gallery/${img.filename}?accountId=${accountId}`, { method: 'DELETE' });
      toast.success('Image deleted.');
      setPopupIndex(null);
      await refreshGalleryAndFolders();
    } catch {
      toast.error('Failed to delete image.');
    }
  }
  async function saveCaption() {
    const img = popupImages[popupIndex];
    try {
      await apiFetch(`http://localhost:5000/api/gallery/${img.filename}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caption: captionInput, accountId }),
      });
      toast.success('Caption updated.');
      setIsEditingCaption(false);
      await refreshGalleryAndFolders();
    } catch {
      toast.error('Failed to save caption.');
    }
  }

  // ----------- Folder modal UI -------------
  const renderFolderModal = () => (
    <div style={{
      position: 'fixed', zIndex: 1600, top: 0, left: 0, width: '100%', height: '100vh',
      background: 'rgba(0,0,0,0.94)', display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{
        background: '#191919', borderRadius: 16, padding: 34, minWidth: 340, maxWidth: 430, boxShadow: '0 4px 24px #000'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
          <h2 style={{ color: '#ffe066', fontWeight: 800, fontSize: 22 }}>Folders</h2>
          <button
            onClick={() => setShowFolderModal(false)}
            style={{
              background: 'transparent', color: '#f87171',
              border: 'none', fontWeight: 'bold', fontSize: 26, cursor: 'pointer'
            }}>✕</button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 11, marginBottom: 22 }}>
          {folders.map((folder, i) => (
            <div key={folder} style={{
              background: folder === selectedFolder ? '#facc15' : '#252525',
              color: folder === selectedFolder ? '#000' : '#ffe066',
              borderRadius: 8,
              padding: '10px 18px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 7
            }}>
              <FaFolder />
              <span
                style={{ cursor: 'pointer' }}
                onClick={() => {
                  setSelectedFolder(folder);
                  setShowFolderModal(false);
                  setShowAllGallery(false);
                }}
              >{folder}</span>
              {folder !== 'All' && (
                <>
                  <button title="Rename" style={{ marginLeft: 7, background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}
                    onClick={() => handleRenameFolder(i)}><FaEdit /></button>
                  <button title="Delete" style={{ background: 'none', border: 'none', color: '#c00', cursor: 'pointer' }}
                    onClick={() => handleDeleteFolder(i)}><FaTrash /></button>
                </>
              )}
            </div>
          ))}
          <button
            style={{
              background: '#ffe066', color: '#000', border: 'none', fontWeight: 700, borderRadius: 8,
              padding: '8px 16px', cursor: 'pointer', marginLeft: 12, display: 'flex', alignItems: 'center', gap: 6
            }}
            onClick={handleCreateFolder}
          ><FaFolderPlus /> Add Folder</button>
        </div>
        <div style={{ color: '#aaa', fontSize: 15, marginTop: 12 }}>
          <i>Move images by editing them in the gallery.</i>
        </div>
      </div>
    </div>
  );

  // ----------- Upload preview & crop modal -------------
  const renderUploadPreviewModal = () => {
    const current = multiUploadFiles[multiUploadIdx];
    if (!current) return null;
    return (
      <div style={{
        position: 'fixed', zIndex: 2200, top: 0, left: 0, width: '100%', height: '100vh',
        background: 'rgba(0,0,0,0.96)', display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        <div style={{
          background: '#181818', borderRadius: 16, padding: 24, width: 360,
          display: 'flex', flexDirection: 'column', alignItems: 'center', boxShadow: '0 4px 24px #000'
        }}>
          <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ color: '#ffe066', fontWeight: 800, fontSize: 16 }}>
              Preview {multiUploadFiles.length > 1 ? `(${multiUploadIdx + 1}/${multiUploadFiles.length})` : ''}
            </div>
            <button onClick={handleRemoveUpload}
              style={{
                background: 'transparent', color: '#f87171',
                border: 'none', fontWeight: 'bold', fontSize: 26, cursor: 'pointer'
              }}>✕</button>
          </div>
          {current.preview && !showCropper && (
            <img
              src={current.preview}
              alt="Upload Preview"
              style={{
                width: 180, height: 180, objectFit: 'cover',
                borderRadius: 10, border: '2px solid #facc15', marginBottom: 12
              }}
            />
          )}
          {showCropper && (
            <>
              <div style={{ width: 220, height: 220, position: 'relative', marginBottom: 10 }}>
                <Cropper
                  image={current.preview}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onCropComplete}
                  cropShape="rect"
                  showGrid={true}
                />
              </div>
              <div style={{ width: 190, margin: '14px auto 6px auto', textAlign: 'center' }}>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.01}
                  value={zoom}
                  onChange={e => setZoom(Number(e.target.value))}
                  style={{ width: '100%' }}
                />
                <div style={{ color: '#facc15', fontWeight: 600, fontSize: 13 }}>Zoom</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 14, marginTop: 8 }}>
                <button onClick={handleSaveCrop}
                  style={{
                    background: '#facc15', color: '#000', border: 'none', borderRadius: 8,
                    padding: '0.5rem 1.6rem', fontWeight: 'bold', fontSize: 15
                  }}>
                  Save Crop
                </button>
                <button onClick={handleCancelCrop}
                  style={{
                    background: 'transparent', color: '#f87171', border: 'none',
                    fontWeight: 'bold', fontSize: 16
                  }}>
                  Cancel
                </button>
              </div>
            </>
          )}
          {!showCropper && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 16 }}>
              <button
                style={{
                  background: '#ffe066', color: '#000', fontWeight: 700, border: 'none',
                  borderRadius: 7, padding: '7px 22px', fontSize: 15, cursor: 'pointer'
                }}
                onClick={() => setShowCropper(true)}
              >
                Crop
              </button>
              <button
                onClick={handleRemoveUpload}
                style={{
                  background: 'transparent', color: '#f87171', fontWeight: 700, border: 'none',
                  fontSize: 15, cursor: 'pointer'
                }}
              >
                Remove
              </button>
              {multiUploadFiles.length > 1 && (
                <>
                  <button
                    disabled={multiUploadIdx === 0}
                    style={{
                      background: '#232323', color: '#ffe066', fontWeight: 700, border: 'none',
                      borderRadius: 7, padding: '7px 15px', fontSize: 16, cursor: 'pointer', marginLeft: 10,
                      opacity: multiUploadIdx === 0 ? 0.5 : 1
                    }}
                    onClick={() => setMultiUploadIdx(i => Math.max(0, i - 1))}
                  >Prev</button>
                  <button
                    disabled={multiUploadIdx === multiUploadFiles.length - 1}
                    style={{
                      background: '#232323', color: '#ffe066', fontWeight: 700, border: 'none',
                      borderRadius: 7, padding: '7px 15px', fontSize: 16, cursor: 'pointer', marginLeft: 5,
                      opacity: multiUploadIdx === multiUploadFiles.length - 1 ? 0.5 : 1
                    }}
                    onClick={() => setMultiUploadIdx(i => Math.min(multiUploadFiles.length - 1, i + 1))}
                  >Next</button>
                </>
              )}
            </div>
          )}
          {!showCropper && (
            <div style={{ textAlign: 'center', marginTop: 18 }}>
              <button
                onClick={handleUploadSave}
                disabled={uploading}
                style={{
                  background: '#facc15',
                  color: '#000',
                  fontWeight: 700,
                  border: 'none',
                  borderRadius: 7,
                  padding: '10px 32px',
                  fontSize: 17,
                  marginTop: 4,
                  cursor: uploading ? 'not-allowed' : 'pointer',
                  opacity: uploading ? 0.6 : 1
                }}>
                {uploading ? 'Uploading...' : 'Save to Gallery'}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ----------- Popup Viewer Modal -------------
  const renderPopupModal = () =>
    popupIndex !== null && popupImages[popupIndex] && (
      <ImagePopupViewer
        img={popupImages[popupIndex]}
        popupImages={popupImages}
        getGalleryImgSrc={getGalleryImgSrc}
        prevPopupImg={prevPopupImg}
        nextPopupImg={nextPopupImg}
        deleteImage={deleteImage}
        isEditingCaption={isEditingCaption}
        setIsEditingCaption={setIsEditingCaption}
        captionInput={captionInput}
        setCaptionInput={setCaptionInput}
        saveCaption={saveCaption}
        closePopup={() => setPopupIndex(null)}
        popupIndex={popupIndex}
      />
    );

  // ----------- Render ----------
  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <h2 style={sectionTitle}>Image Gallery</h2>
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            style={{
              background: '#facc15', color: '#000', fontWeight: 700, border: 'none', borderRadius: 7,
              padding: '5px 16px', cursor: 'pointer'
            }}
            {...getRootProps()}
            disabled={!user || !user._id}
          >Upload Image(s)
            <input {...getInputProps()} style={{ display: 'none' }} />
          </button>
          <button
            style={{
              background: '#232323', color: '#ffe066', fontWeight: 700, border: 'none', borderRadius: 7,
              padding: '5px 12px', cursor: 'pointer'
            }}
            onClick={() => setShowFolderModal(true)}
          >Folders</button>
          <button
            style={{
              background: '#232323', color: '#ffe066', fontWeight: 700, border: 'none', borderRadius: 7,
              padding: '5px 12px', cursor: 'pointer'
            }}
            onClick={() => setShowAllGallery(true)}
          >View All</button>
        </div>
      </div>
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="gallery-droppable" direction="horizontal">
          {(provided) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.1rem' }}
            >
              {visibleImages.map((img, i) => (
                <Draggable draggableId={`img-${i}`} index={i} key={i}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                      style={{
                        ...provided.draggableProps.style,
                        opacity: snapshot.isDragging ? 0.7 : 1
                      }}
                    >
                      <div style={{
                        position: 'relative',
                        border: '1px solid #292929',
                        borderRadius: '10px',
                        overflow: 'hidden',
                        background: '#191919',
                        cursor: 'pointer'
                      }}>
                        <img
                          src={getGalleryImgSrc(img)}
                          alt={`Gallery ${i + 1}`}
                          style={{
                            width: '100%',
                            height: '8rem',
                            objectFit: 'cover',
                            display: 'block',
                          }}
                          onClick={() => {
                            const popupIdx = popupImages.findIndex(im =>
                              im.filename === img.filename && (img.filename !== undefined)
                            );
                            setPopupIndex(popupIdx !== -1 ? popupIdx : i);
                            setIsEditingCaption(false);
                            setCaptionInput(img.caption || '');
                          }}
                        />
                        <div style={{
                          position: 'absolute', top: 5, right: 8, display: 'flex', gap: 4
                        }}>
                          <select
                            value={img.folder}
                            onChange={e => handleMoveImageToFolder(galleryImages.indexOf(img), e.target.value)}
                            style={{
                              background: '#222', color: '#ffe066', border: '1px solid #333',
                              borderRadius: 5, fontSize: 12, padding: '2px 8px'
                            }}>
                            {folders.map(f => (
                              <option key={f} value={f}>{f}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
              {galleryImages.length === 0 && (
                <div style={{ color: '#ccc', fontStyle: 'italic' }}>
                  No uploaded images yet.
                </div>
              )}
            </div>
          )}
        </Droppable>
      </DragDropContext>
      {galleryImages.length > 8 && !showAllGallery && (
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <button
            style={{
              background: '#232323', color: '#ffe066', fontWeight: 700, border: 'none', borderRadius: 7,
              padding: '5px 18px', marginTop: 8, cursor: 'pointer'
            }}
            onClick={() => setShowMoreGallery(s => !s)}
          >
            {showMoreGallery ? 'View Less' : 'View More'}
          </button>
        </div>
      )}

      {showFolderModal && renderFolderModal()}
      {showUploadPreview && renderUploadPreviewModal()}
      {renderPopupModal()}
    </div>
  );
}
