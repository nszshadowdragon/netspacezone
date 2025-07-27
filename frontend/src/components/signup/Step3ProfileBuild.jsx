import React, { useState, useCallback, useEffect } from 'react';
import Dropzone from 'react-dropzone';
import Cropper from 'react-easy-crop';
import getCroppedImg from './utils/cropImage';
import Modal from './utils/Modal';

const Step3ProfileBuild = ({ onDataChange }) => {
  const [profilePic, setProfilePic]   = useState(null);
  const [avatar, setAvatar]           = useState('');
  const [profileShape, setProfileShape] = useState('circle');
  const [bannerPic, setBannerPic]     = useState(null);
  const [cropSrc, setCropSrc]         = useState(null);
  const [croppingFor, setCroppingFor] = useState(null);
  const [crop, setCrop]               = useState({ x: 0, y: 0 });
  const [zoom, setZoom]               = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  const [quote, setQuote]             = useState('');
  const [location, setLocation]       = useState('');
  const [tags, setTags]               = useState([]);
  const [tagInput, setTagInput]       = useState('');
  const [socials, setSocials]         = useState({
    twitter: '', instagram: '', linkedin: '',
    youtube: '', discord: '', website: ''
  });

  // Lift all data up
  useEffect(() => {
    onDataChange({
      profilePic: profilePic || avatar,
      profileShape,
      bannerPic,
      quote,
      location,
      tags,
      socials
    });
  }, [
    profilePic, avatar, profileShape, bannerPic,
    quote, location, tags, socials, onDataChange
  ]);

  const openCropper = (file, type) => {
    setCropSrc(URL.createObjectURL(file));
    setCroppingFor(type);
  };

  const onCropComplete = useCallback((_, pix) => setCroppedAreaPixels(pix), []);

  const handleCropSave = async () => {
    const img = await getCroppedImg(cropSrc, croppedAreaPixels, profileShape === 'circle');
    if (croppingFor === 'profile') {
      setProfilePic(img);
      setAvatar('');
    } else {
      setBannerPic(img);
    }
    setCroppingFor(null);
    setCropSrc(null);
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags(tags.concat(tagInput.trim()));
      setTagInput('');
    }
  };

  const handleSocialChange = (key, val) => {
    setSocials(prev => ({ ...prev, [key]: val }));
  };

  return (
    <div className="space-y-6 text-gray-900">
      {/* Banner */}
      <div>
        <label className="block text-sm font-medium">Upload Banner</label>
        <Dropzone onDrop={files => openCropper(files[0], 'banner')}>
          {({ getRootProps, getInputProps }) => (
            <div
              {...getRootProps()}
              className="border border-dashed border-gray-300 p-4 text-center cursor-pointer"
            >
              <input {...getInputProps()} />
              {bannerPic ? (
                <img src={bannerPic} className="w-full rounded" alt="Banner" />
              ) : (
                <p>Drag or click to upload banner</p>
              )}
            </div>
          )}
        </Dropzone>
      </div>

      {/* Profile Shape */}
      <div>
        <label className="block text-sm font-medium">Profile Picture Shape</label>
        <select
          value={profileShape}
          onChange={e => setProfileShape(e.target.value)}
          className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
        >
          <option value="circle">Circle</option>
          <option value="square">Square</option>
        </select>
      </div>

      {/* Profile Picture */}
      <div>
        <label className="block text-sm font-medium">Upload Profile Picture</label>
        <Dropzone onDrop={files => openCropper(files[0], 'profile')}>
          {({ getRootProps, getInputProps }) => (
            <div
              {...getRootProps()}
              className="border border-dashed border-gray-300 p-4 text-center cursor-pointer"
            >
              <input {...getInputProps()} />
              {profilePic ? (
                <img
                  src={profilePic}
                  alt="Profile"
                  className={`w-32 h-32 mx-auto object-cover ${
                    profileShape === 'circle' ? 'rounded-full' : 'rounded'
                  }`}
                />
              ) : (
                <p>Drag or click to upload profile pic</p>
              )}
            </div>
          )}
        </Dropzone>
      </div>

      {/* Or Avatar URL */}
      <div>
        <label className="block text-sm font-medium">Or Avatar URL</label>
        <div className="flex gap-2">
          <input
            type="text"
            className="flex-1 px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 text-gray-900"
            placeholder="https://..."
            value={avatar}
            onChange={e => { setAvatar(e.target.value); setProfilePic(null); }}
          />
        </div>
      </div>

      {/* Favorite Quote */}
      <div>
        <label className="block text-sm font-medium">Favorite Quote</label>
        <input
          type="text"
          className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 text-gray-900"
          value={quote}
          onChange={e => setQuote(e.target.value)}
        />
      </div>

      {/* Location */}
      <div>
        <label className="block text-sm font-medium">Location</label>
        <input
          type="text"
          className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 text-gray-900"
          value={location}
          onChange={e => setLocation(e.target.value)}
        />
      </div>

      {/* Tags */}
      <div>
        <label className="block text-sm font-medium">Tags</label>
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            className="flex-1 px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 text-gray-900"
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
          />
          <button
            type="button"
            onClick={handleAddTag}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            Add
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {tags.map(t => (
            <span key={t} className="px-3 py-1 bg-gray-200 rounded-full text-sm flex items-center gap-1">
              {t} <button onClick={() => setTags(tags.filter(x => x !== t))}>×</button>
            </span>
          ))}
        </div>
      </div>

      {/* Social Links */}
      <div>
        <label className="block text-sm font-medium">Social Links</label>
        {Object.entries(socials).map(([key, val]) => (
          <input
            key={key}
            type="text"
            placeholder={key}
            value={val}
            onChange={e => handleSocialChange(key, e.target.value)}
            className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 text-gray-900 mb-2"
          />
        ))}
      </div>

      {/* Cropper Modal */}
      {cropSrc && (
        <Modal onClose={() => setCroppingFor(null)} onSave={handleCropSave}>
          <div className="relative w-full h-64 bg-black">
            <Cropper
              image={cropSrc}
              crop={crop}
              zoom={zoom}
              aspect={croppingFor === 'profile' ? 1 : 16 / 9}
              cropShape={profileShape === 'circle' ? 'round' : 'rect'}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          </div>
        </Modal>
      )}
    </div>
);
};

export default Step3ProfileBuild;
