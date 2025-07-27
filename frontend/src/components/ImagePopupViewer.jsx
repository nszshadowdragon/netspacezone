import React, { useState, useEffect } from 'react';
import {
  FaChevronLeft, FaChevronRight, FaTrash, FaShareAlt,
  FaThumbsDown, FaEdit, FaReply, FaEllipsisV, FaCommentDots
} from 'react-icons/fa';
import { MdRocketLaunch } from 'react-icons/md';

function formatTime(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
}

function useIsMobile(threshold = 700) {
  const [isMobile, setIsMobile] = useState(window.innerWidth < threshold);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < threshold);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [threshold]);
  return isMobile;
}

export default function ImagePopupViewer({
  img,
  popupImages,
  getGalleryImgSrc,
  prevPopupImg,
  nextPopupImg,
  deleteImage,
  isEditingCaption,
  setIsEditingCaption,
  captionInput,
  setCaptionInput,
  saveCaption,
  closePopup,
  popupIndex,
  user,
  updateGalleryImage,
}) {
  const userId = user?._id;
  const [showComments, setShowComments] = useState(true);
  const [commentInput, setCommentInput] = useState('');
  const [replyBoxFor, setReplyBoxFor] = useState(null);
  const [replyInput, setReplyInput] = useState('');
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingValue, setEditingValue] = useState('');
  const [shareStatus, setShareStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const [optimisticLiked, setOptimisticLiked] = useState(null);
  const [optimisticDisliked, setOptimisticDisliked] = useState(null);

  const isMobile = useIsMobile();

  function extractId(u) {
    if (!u) return u;
    if (typeof u === "string") return u;
    if (typeof u === "object") return u._id || u.id || u;
    return u;
  }

  function formatComments(arr) {
    return (arr || []).map(c => ({
      ...c,
      user: extractId(c.user),
      likes: (c.likes || []).map(extractId),
      dislikes: (c.dislikes || []).map(extractId),
      replies: (c.replies || []).map(r => ({
        ...r,
        user: extractId(r.user),
        likes: (r.likes || []).map(extractId),
        dislikes: (r.dislikes || []).map(extractId),
      })),
    }));
  }

  useEffect(() => {
    setShowComments(true);
    setCommentInput('');
    setReplyBoxFor(null);
    setReplyInput('');
    setEditingCommentId(null);
    setEditingValue('');
    setShareStatus('');
    setMenuOpen(false);
    setOptimisticLiked(null);
    setOptimisticDisliked(null);
  }, [img, userId]);

  const likesArr = optimisticLiked !== null
    ? (optimisticLiked
      ? [...(img.likes || []), userId]
      : (img.likes || []).filter(id => extractId(id) !== userId))
    : img.likes || [];
  const dislikesArr = optimisticDisliked !== null
    ? (optimisticDisliked
      ? [...(img.dislikes || []), userId]
      : (img.dislikes || []).filter(id => extractId(id) !== userId))
    : img.dislikes || [];
  const liked = likesArr.map(extractId).includes(userId);
  const disliked = dislikesArr.map(extractId).includes(userId);

  async function handleLike() {
    if (submitting) return;
    setSubmitting(true);
    let newLikes = likesArr.map(extractId), newDislikes = dislikesArr.map(extractId);
    let newLiked = liked, newDisliked = disliked;

    if (liked) {
      newLiked = false;
      newLikes = newLikes.filter(id => id !== userId);
    } else {
      newLiked = true;
      newLikes = [...newLikes, userId];
      if (disliked) {
        newDisliked = false;
        newDislikes = newDislikes.filter(id => id !== userId);
      }
    }

    setOptimisticLiked(newLiked);
    setOptimisticDisliked(newDisliked);

    await updateGalleryImage({
      ...img,
      likes: newLikes,
      dislikes: newDislikes,
      comments: formatComments(img.comments),
    });
    setSubmitting(false);
  }

  async function handleDislike() {
    if (submitting) return;
    setSubmitting(true);
    let newLikes = likesArr.map(extractId), newDislikes = dislikesArr.map(extractId);
    let newLiked = liked, newDisliked = disliked;

    if (disliked) {
      newDisliked = false;
      newDislikes = newDislikes.filter(id => id !== userId);
    } else {
      newDisliked = true;
      newDislikes = [...newDislikes, userId];
      if (liked) {
        newLiked = false;
        newLikes = newLikes.filter(id => id !== userId);
      }
    }

    setOptimisticLiked(newLiked);
    setOptimisticDisliked(newDisliked);

    await updateGalleryImage({
      ...img,
      likes: newLikes,
      dislikes: newDislikes,
      comments: formatComments(img.comments),
    });
    setSubmitting(false);
  }

  async function handleComment(e) {
    e.preventDefault();
    if (!commentInput.trim() || submitting) return;
    setSubmitting(true);

    const newComment = {
      _id: Math.random().toString(36).slice(2),
      user: userId,
      text: commentInput,
      createdAt: new Date().toISOString(),
      likes: [],
      dislikes: [],
      replies: []
    };
    const newComments = [...formatComments(img.comments || []), newComment];
    setCommentInput('');

    await updateGalleryImage({
      ...img,
      comments: newComments,
      likes: likesArr.map(extractId),
      dislikes: dislikesArr.map(extractId),
    });
    setSubmitting(false);
  }

  async function handleReply(e, commentId) {
    e.preventDefault();
    if (!replyInput.trim() || submitting) return;
    setSubmitting(true);
    const newReply = {
      _id: Math.random().toString(36).slice(2),
      user: userId,
      text: replyInput,
      createdAt: new Date().toISOString(),
      likes: [],
      dislikes: []
    };
    const newComments = formatComments(img.comments || []).map(c =>
      c._id === commentId
        ? { ...c, replies: [...(c.replies || []), newReply] }
        : c
    );
    setReplyInput('');
    setReplyBoxFor(null);

    await updateGalleryImage({
      ...img,
      comments: newComments,
      likes: likesArr.map(extractId),
      dislikes: dislikesArr.map(extractId),
    });
    setSubmitting(false);
  }

  async function handleLikeDislikeComment(commentId, isReply, replyId, isLike) {
    let newComments;
    if (isReply) {
      newComments = formatComments(img.comments || []).map(c => {
        if (c._id === commentId) {
          return {
            ...c,
            replies: (c.replies || []).map(r => {
              if (r._id === replyId) {
                return {
                  ...r,
                  likes: isLike
                    ? (r.likes.includes(userId) ? r.likes : [...r.likes, userId])
                    : r.likes.filter(id => id !== userId),
                  dislikes: !isLike
                    ? (r.dislikes.includes(userId) ? r.dislikes : [...r.dislikes, userId])
                    : r.dislikes.filter(id => id !== userId),
                }
              }
              return r;
            })
          }
        }
        return c;
      });
    } else {
      newComments = formatComments(img.comments || []).map(c => {
        if (c._id === commentId) {
          return {
            ...c,
            likes: isLike
              ? (c.likes.includes(userId) ? c.likes : [...c.likes, userId])
              : c.likes.filter(id => id !== userId),
            dislikes: !isLike
              ? (c.dislikes.includes(userId) ? c.dislikes : [...c.dislikes, userId])
              : c.dislikes.filter(id => id !== userId),
          }
        }
        return c;
      });
    }
    await updateGalleryImage({
      ...img,
      comments: newComments,
      likes: likesArr.map(extractId),
      dislikes: dislikesArr.map(extractId),
    });
  }

  async function handleEditComment(commentId, isReply, replyId, value) {
    let newComments;
    if (isReply) {
      newComments = formatComments(img.comments || []).map(c => {
        if (c._id === commentId) {
          return {
            ...c,
            replies: (c.replies || []).map(r =>
              r._id === replyId ? { ...r, text: value } : r
            )
          };
        }
        return c;
      });
    } else {
      newComments = formatComments(img.comments || []).map(c =>
        c._id === commentId ? { ...c, text: value } : c
      );
    }
    setEditingCommentId(null);
    setEditingValue('');
    await updateGalleryImage({
      ...img,
      comments: newComments,
      likes: likesArr.map(extractId),
      dislikes: dislikesArr.map(extractId),
    });
  }

  async function handleDeleteComment(commentId, isReply, replyId) {
    let newComments;
    if (isReply) {
      newComments = formatComments(img.comments || []).map(c =>
        c._id === commentId
          ? { ...c, replies: c.replies.filter(r => r._id !== replyId) }
          : c
      );
    } else {
      newComments = formatComments(img.comments || []).filter(c => c._id !== commentId);
    }
    await updateGalleryImage({
      ...img,
      comments: newComments,
      likes: likesArr.map(extractId),
      dislikes: dislikesArr.map(extractId),
    });
  }

  function handleShare() {
    const url = window.location.origin + getGalleryImgSrc(img);
    navigator.clipboard.writeText(url).then(() => {
      setShareStatus('Image link copied!');
      setTimeout(() => setShareStatus(''), 1500);
    });
  }

  // Buttons for comments: subtle, all on one row, smaller
  const commentIconBtnStyle = {
    background: 'none',
    border: 'none',
    color: '#b4b7be',
    fontSize: '90%',
    cursor: 'pointer',
    padding: '0 4px',
    minWidth: 22,
    height: 20,
    display: 'inline-flex',
    alignItems: 'center',
    borderRadius: 5,
    opacity: 0.80,
    marginLeft: 1,
    marginRight: 1,
    transition: 'color 0.12s, background 0.14s',
  };

  function renderReplies(comment) {
    return (comment.replies || []).map(reply => (
      <div key={reply._id} style={{
        marginLeft: 24, marginTop: 8,
        background: 'rgba(38,42,54,0.80)', borderRadius: 8,
        padding: '7px 12px', color: '#e8e8e8', fontSize: 14,
        display: 'flex', flexDirection: 'column', boxShadow: '0 1px 4px #0002'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 0 }}>
          <span style={{ color: '#7cd9fd', fontWeight: 600, marginRight: 7, fontSize: 13.5 }}>
            {typeof reply.user === "object" && reply.user.name
              ? reply.user.name
              : typeof reply.user === "string"
                ? reply.user.slice(0, 7)
                : "User"}
          </span>
          <span style={{
            color: '#999', fontSize: 11, marginRight: 5,
            fontWeight: 400, letterSpacing: 0.1,
          }}>{formatTime(reply.createdAt)}</span>
          {extractId(reply.user) === userId && (
            <>
              <button style={commentIconBtnStyle} onClick={() => { setEditingCommentId('reply-' + reply._id); setEditingValue(reply.text); }} title="Edit Reply">
                <FaEdit />
              </button>
              <button style={commentIconBtnStyle} onClick={() => handleDeleteComment(comment._id, true, reply._id)} title="Delete Reply">
                <FaTrash />
              </button>
            </>
          )}
          <button style={commentIconBtnStyle} onClick={() => setReplyBoxFor(comment._id)} title="Reply">
            <FaReply />
          </button>
          <button style={{
            ...commentIconBtnStyle,
            color: (reply.likes || []).includes(userId) ? '#18e1ff' : '#b4b7be',
          }}
            onClick={() => handleLikeDislikeComment(comment._id, true, reply._id, true)}
            title="Like Reply"
          >
            <MdRocketLaunch style={{ fontSize: 13 }} /> <span style={{ marginLeft: 2 }}>{(reply.likes || []).length || 0}</span>
          </button>
          <button style={{
            ...commentIconBtnStyle,
            color: (reply.dislikes || []).includes(userId) ? '#ff4545' : '#b4b7be',
          }}
            onClick={() => handleLikeDislikeComment(comment._id, true, reply._id, false)}
            title="Dislike Reply"
          >
            <FaThumbsDown style={{ fontSize: 12 }} /> <span style={{ marginLeft: 2 }}>{(reply.dislikes || []).length || 0}</span>
          </button>
        </div>
        {editingCommentId === 'reply-' + reply._id ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              value={editingValue}
              onChange={e => setEditingValue(e.target.value)}
              style={{ flex: 1, padding: 5, fontSize: 13, borderRadius: 4 }}
              maxLength={140}
            />
            <button style={commentIconBtnStyle} onClick={() => handleEditComment(comment._id, true, reply._id, editingValue)}>Save</button>
            <button style={commentIconBtnStyle} onClick={() => setEditingCommentId(null)}>Cancel</button>
          </div>
        ) : (
          <div style={{ marginBottom: 0, marginTop: 2 }}>{reply.text}</div>
        )}
      </div>
    ));
  }

  return (
    <div
      style={{
        position: 'fixed',
        zIndex: 9999,
        top: 0, left: 0, width: '100%', height: '100vh',
        background: 'radial-gradient(ellipse at 60% 25%, #23273a99 0%, #16171e 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(6px)'
      }}
      onClick={closePopup}
    >
      <div
        style={{
          position: 'relative',
          background: 'linear-gradient(120deg, #191c25 65%, #181a1f 100%)',
          borderRadius: 24,
          minWidth: 420,
          width: 'min(970px, 98vw)',
          maxWidth: 1040,
          maxHeight: '97vh',
          boxShadow: '0 6px 56px #000b',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'stretch',
          gap: 0,
          overflow: 'hidden',
          border: '2px solid #292b36',
        }}
        onClick={e => e.stopPropagation()}
      >

        {/* COMMENT PANEL (LEFT SIDE) */}
        {(showComments || !isMobile) && (
          <div style={{
            flex: 1.05, background: 'rgba(21,22,31,0.97)', borderTopLeftRadius: 20, borderBottomLeftRadius: 20,
            padding: 0, minWidth: 310, maxWidth: 410,
            display: 'flex', flexDirection: 'column', boxShadow: '4px 0 18px #0004'
          }}>
            <div style={{
              color: '#ffe066', fontWeight: 800, fontSize: 20, letterSpacing: 0.5,
              background: 'rgba(18,18,24,0.99)', borderTopLeftRadius: 20, padding: '18px 0 13px 28px',
              position: 'sticky', top: 0, zIndex: 1, boxShadow: '0 2px 10px #0001'
            }}>
              Comments
            </div>
            <div style={{
              flex: 1, overflowY: 'auto', padding: '10px 16px 80px 12px', minHeight: 200, maxHeight: '62vh',
            }}>
              {(img.comments || []).length === 0 && (
                <div style={{ color: '#bbb', fontSize: 15, margin: '22px 0' }}>No comments yet. Be first!</div>
              )}
              {(img.comments || []).map(comment => (
                <div key={comment._id} style={{
                  background: 'rgba(38,42,54,0.81)',
                  borderRadius: 9,
                  padding: '10px 11px 6px 13px',
                  color: '#fff',
                  fontSize: 15,
                  marginBottom: 13,
                  boxShadow: '0 1px 4px #0001'
                }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', flexWrap: 'wrap',
                    gap: 0, marginBottom: 1,
                  }}>
                    <span style={{
                      color: '#7ce9fd', fontWeight: 600, marginRight: 7, fontSize: 14.5,
                    }}>
                      {typeof comment.user === "object" && comment.user.name
                        ? comment.user.name
                        : typeof comment.user === "string"
                          ? comment.user.slice(0, 7)
                          : "User"}
                    </span>
                    <span style={{
                      color: '#999', fontSize: 11, marginRight: 5,
                      fontWeight: 400, letterSpacing: 0.1,
                    }}>{formatTime(comment.createdAt)}</span>
                    {extractId(comment.user) === userId && (
                      <>
                        <button style={commentIconBtnStyle} onClick={() => { setEditingCommentId('main-' + comment._id); setEditingValue(comment.text); }} title="Edit">
                          <FaEdit />
                        </button>
                        <button style={commentIconBtnStyle} onClick={() => handleDeleteComment(comment._id, false)} title="Delete">
                          <FaTrash />
                        </button>
                      </>
                    )}
                    <button style={commentIconBtnStyle} onClick={() => setReplyBoxFor(comment._id)} title="Reply">
                      <FaReply />
                    </button>
                    <button style={{
                      ...commentIconBtnStyle,
                      color: (comment.likes || []).includes(userId) ? '#18e1ff' : '#b4b7be',
                    }}
                      onClick={() => handleLikeDislikeComment(comment._id, false, null, true)}
                      title="Like"
                    >
                      <MdRocketLaunch style={{ fontSize: 13 }} /> <span style={{ marginLeft: 2 }}>{(comment.likes || []).length || 0}</span>
                    </button>
                    <button style={{
                      ...commentIconBtnStyle,
                      color: (comment.dislikes || []).includes(userId) ? '#ff4545' : '#b4b7be',
                    }}
                      onClick={() => handleLikeDislikeComment(comment._id, false, null, false)}
                      title="Dislike"
                    >
                      <FaThumbsDown style={{ fontSize: 12 }} /> <span style={{ marginLeft: 2 }}>{(comment.dislikes || []).length || 0}</span>
                    </button>
                  </div>
                  {editingCommentId === 'main-' + comment._id ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input
                        value={editingValue}
                        onChange={e => setEditingValue(e.target.value)}
                        style={{ flex: 1, padding: 6, fontSize: 14, borderRadius: 4 }}
                        maxLength={140}
                      />
                      <button style={commentIconBtnStyle} onClick={() => handleEditComment(comment._id, false, null, editingValue)}>Save</button>
                      <button style={commentIconBtnStyle} onClick={() => setEditingCommentId(null)}>Cancel</button>
                    </div>
                  ) : (
                    <div style={{ marginBottom: 2, marginTop: 1 }}>{comment.text}</div>
                  )}
                  {renderReplies(comment)}
                  {replyBoxFor === comment._id && (
                    <form onSubmit={e => handleReply(e, comment._id)} style={{ marginTop: 7, display: 'flex', gap: 5 }}>
                      <input
                        type="text"
                        value={replyInput}
                        onChange={e => setReplyInput(e.target.value)}
                        placeholder="Write a reply..."
                        maxLength={140}
                        style={{ flex: 1, borderRadius: 6, border: '1px solid #ffe066', padding: '6px 10px', fontSize: 13, color: '#1d2024' }}
                      />
                      <button type="submit" style={{
                        background: '#ffe066', color: '#232323', fontWeight: 700, border: 'none',
                        borderRadius: 6, padding: '6px 12px', fontSize: 13, cursor: 'pointer'
                      }}>
                        Reply
                      </button>
                      <button type="button" onClick={() => setReplyBoxFor(null)} style={commentIconBtnStyle}>Cancel</button>
                    </form>
                  )}
                </div>
              ))}
            </div>
            <form
              style={{
                display: 'flex', gap: 8, padding: '14px 16px 14px 13px', background: '#191a21',
                borderBottomLeftRadius: 20, borderTop: '1.5px solid #22232d', position: 'sticky', bottom: 0,
                zIndex: 1,
              }}
              onSubmit={handleComment}
            >
              <input
                type="text"
                value={commentInput}
                onChange={e => setCommentInput(e.target.value)}
                placeholder="Add a comment…"
                maxLength={140}
                style={{
                  flex: 1, borderRadius: 7, border: '1.5px solid #ffe066',
                  padding: '8px 12px', fontSize: 14, color: '#191b20'
                }}
                disabled={submitting}
              />
              <button
                type="submit"
                style={{
                  background: '#ffe066', color: '#191919', fontWeight: 700, border: 'none',
                  borderRadius: 8, padding: '8px 18px', fontSize: 14, cursor: submitting ? 'wait' : 'pointer'
                }}
                disabled={submitting}
              >
                Post
              </button>
            </form>
          </div>
        )}

        {/* MAIN VIEWER SECTION */}
        <div style={{
          flex: 1.9, minWidth: 350, maxWidth: 600,
          display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '36px 20px 36px 20px',
          position: 'relative', background: 'transparent',
        }}>
          {/* Close X */}
          <button
            onClick={closePopup}
            style={{
              position: 'absolute',
              top: 16, right: 22, fontSize: 25, color: '#ffe3ef',
              background: 'rgba(40,35,45,0.7)', border: 'none', cursor: 'pointer',
              zIndex: 8, fontWeight: 'bold', borderRadius: '50%', boxShadow: '0 2px 10px #0008',
              width: 40, height: 40, lineHeight: '36px', textAlign: 'center', transition: 'background 0.17s',
            }}
            aria-label="Close"
            tabIndex={0}
            onMouseOver={e => e.currentTarget.style.background = '#ff637a'}
            onMouseOut={e => e.currentTarget.style.background = 'rgba(40,35,45,0.7)'}
          >✕</button>

          {/* 3-dot Dropdown */}
          <div style={{
            position: 'absolute',
            top: 'calc(38px + 0.5vw)',
            left: 'calc(18px + 0.5vw)',
            zIndex: 8,
          }}>
            <button
              onClick={() => setMenuOpen(v => !v)}
              style={{
                background: 'rgba(36,39,45,0.93)',
                color: '#ffe066',
                fontSize: 23,
                padding: '5px 9px',
                borderRadius: '50%',
                boxShadow: '0 2px 14px #0007',
                border: '1.5px solid #292b36'
              }}
              aria-label="Open menu"
            >
              <FaEllipsisV />
            </button>
            {menuOpen && (
              <div style={{
                position: 'absolute',
                top: 38,
                left: 0,
                minWidth: 118,
                background: 'rgba(29, 31, 39, 0.97)',
                border: '1.5px solid #232431',
                borderRadius: 11,
                boxShadow: '0 8px 32px #000b',
                padding: '7px 0',
                display: 'flex',
                flexDirection: 'column',
                zIndex: 22,
                transition: 'opacity .17s',
              }}>
                <button
                  style={{
                    background: 'none',
                    color: '#ffe066',
                    padding: '11px 22px',
                    borderRadius: 0,
                    justifyContent: 'flex-start',
                    fontSize: 17,
                    fontWeight: 600,
                    borderBottom: '1px solid #232431',
                  }}
                  onClick={() => {
                    setIsEditingCaption(true);
                    setMenuOpen(false);
                  }}
                >
                  <FaEdit style={{ marginRight: 9 }} /> Edit Caption
                </button>
                <button
                  style={{
                    background: 'none',
                    color: '#ff637a',
                    padding: '11px 22px',
                    borderRadius: 0,
                    justifyContent: 'flex-start',
                    fontSize: 17,
                    fontWeight: 600,
                  }}
                  onClick={() => {
                    setMenuOpen(false);
                    setTimeout(() => {
                      if (window.confirm("Delete this image? This cannot be undone.")) deleteImage();
                    }, 120);
                  }}
                >
                  <FaTrash style={{ marginRight: 9 }} /> Delete Image
                </button>
              </div>
            )}
          </div>

          {/* Image + Nav */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 20,
            width: '100%', justifyContent: 'center', marginTop: 38, marginBottom: 10,
            minHeight: 300,
          }}>
            <button
              onClick={() => prevPopupImg(popupImages)}
              style={{
                background: 'rgba(30,30,30,0.38)', color: '#ffe066', border: 'none',
                fontSize: 30, cursor: 'pointer', borderRadius: 9, padding: '7px 6px', transition: 'background .14s'
              }}>
              <FaChevronLeft />
            </button>
            <div style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'linear-gradient(110deg,#181921 60%,#191c21 100%)',
              borderRadius: 20,
              boxShadow: '0 2px 26px #000b',
              padding: 0,
              minHeight: 330,
              minWidth: 240,
              maxHeight: '59vh',
              maxWidth: '36vw',
              overflow: 'hidden',
              width: 'min(99%, 420px)',
              aspectRatio: '5/7',
            }}>
              <img
                src={getGalleryImgSrc(img)}
                alt="Gallery Full View"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  borderRadius: 20,
                  boxShadow: '0 2px 26px #000a',
                  background: '#181922',
                  display: 'block',
                  maxHeight: '59vh',
                  maxWidth: '36vw',
                  minWidth: 230,
                  minHeight: 320,
                  transition: 'box-shadow 0.2s'
                }}
              />
            </div>
            <button
              onClick={() => nextPopupImg(popupImages)}
              style={{
                background: 'rgba(30,30,30,0.38)', color: '#ffe066', border: 'none',
                fontSize: 30, cursor: 'pointer', borderRadius: 9, padding: '7px 6px', transition: 'background .14s'
              }}>
              <FaChevronRight />
            </button>
          </div>

          {/* Caption */}
          <div style={{ marginTop: 8, textAlign: 'center', color: '#ffe066', minHeight: 30, fontWeight: 500, width: '100%' }}>
            {isEditingCaption ? (
              <div>
                <input
                  type="text"
                  value={captionInput}
                  onChange={e => setCaptionInput(e.target.value)}
                  maxLength={120}
                  style={{
                    width: 260,
                    padding: 10,
                    fontSize: 16.5,
                    borderRadius: 8,
                    border: '1.5px solid #ffe066',
                    marginBottom: 8,
                    color: '#141922'
                  }}
                  autoFocus
                />
                <div>
                  <button
                    onClick={saveCaption}
                    style={{
                      background: '#ffe066', color: '#232323', fontWeight: 700,
                      border: 'none', borderRadius: 8, padding: '6px 20px', fontSize: 15, marginRight: 8, cursor: 'pointer'
                    }}
                  >Save</button>
                  <button
                    onClick={() => setIsEditingCaption(false)}
                    style={{
                      background: '#232323', color: '#ffe066', fontWeight: 700,
                      border: 'none', borderRadius: 8, padding: '6px 20px', fontSize: 15, cursor: 'pointer'
                    }}
                  >Cancel</button>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 20, lineHeight: '1.45', padding: '4px 6px', wordBreak: 'break-word' }}>
                {img.caption ? img.caption : <span style={{ color: '#b6b6b6' }}>No caption yet.</span>}
              </div>
            )}
          </div>

          {/* Action Bar */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 14, // Tighter gap between all buttons
            marginTop: 18,
            width: '100%',
            padding: '0 8px',
            flexWrap: 'nowrap'
          }}>
            <button
              onClick={handleLike}
              style={{
                background: 'rgba(27,29,35,0.6)',
                border: 'none',
                color: liked ? '#18e1ff' : '#ffe066',
                fontSize: 24,
                cursor: 'pointer',
                margin: 0,
                padding: '7px 13px',
                display: 'inline-flex',
                alignItems: 'center',
                borderRadius: 9,
                boxShadow: liked ? '0 0 13px #12e1ff77' : '0 1px 8px #0003',
                transition: 'background .18s, color .15s, box-shadow .16s',
                fontWeight: liked ? 700 : 500
              }}
              disabled={submitting}
              title="Like (Rocket Launch)"
            >
              <MdRocketLaunch style={{ transform: 'rotate(-10deg)', fontSize: 20 }} />
              <span style={{ fontSize: 16, fontWeight: 700, marginLeft: 6 }}>{likesArr.length}</span>
            </button>
            <button
              onClick={handleDislike}
              style={{
                background: 'rgba(27,29,35,0.6)',
                border: 'none',
                color: disliked ? '#ff4545' : '#ffe066',
                fontSize: 24,
                cursor: 'pointer',
                margin: 0,
                padding: '7px 13px',
                display: 'inline-flex',
                alignItems: 'center',
                borderRadius: 9,
                boxShadow: disliked ? '0 0 13px #ff454577' : '0 1px 8px #0003',
                transition: 'background .18s, color .15s, box-shadow .16s',
                fontWeight: disliked ? 700 : 500
              }}
              disabled={submitting}
              title="Dislike"
            >
              <FaThumbsDown style={{ fontSize: 18 }} />
              <span style={{ fontSize: 16, fontWeight: 700, marginLeft: 6 }}>{dislikesArr.length}</span>
            </button>
            {isMobile && (
              <button
                onClick={() => setShowComments(c => !c)}
                style={{
                  background: 'rgba(27,29,35,0.6)',
                  border: 'none',
                  color: showComments ? '#ffe066' : '#bbbbbb',
                  fontSize: 21,
                  padding: '7px 13px',
                  borderRadius: 9,
                  display: 'inline-flex',
                  alignItems: 'center',
                  cursor: 'pointer'
                }}>
                <FaCommentDots />
                <span style={{ fontSize: 15, fontWeight: 700, marginLeft: 6 }}>{(img.comments || []).length}</span>
              </button>
            )}
            <button
              onClick={handleShare}
              style={{
                background: 'rgba(27,29,35,0.6)',
                border: 'none',
                color: '#ffe066',
                fontSize: 20,
                padding: '7px 15px',
                borderRadius: 9,
                display: 'inline-flex',
                alignItems: 'center',
                cursor: 'pointer'
              }}>
              <FaShareAlt />
              <span style={{ fontSize: 14, fontWeight: 700, marginLeft: 7 }}>Share</span>
            </button>
          </div>
          {shareStatus && (
            <div style={{
              color: '#62f3c2',
              fontWeight: 700,
              marginTop: 8,
              fontSize: 16,
              background: 'rgba(30, 34, 40, 0.85)',
              borderRadius: 7,
              padding: '5px 17px'
            }}>{shareStatus}</div>
          )}
        </div>
      </div>
    </div>
  );
}
