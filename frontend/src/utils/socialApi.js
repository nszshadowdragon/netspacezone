// src/utils/socialApi.js

import { getToken } from './auth';

const API_URL = '/api/social';

export async function followUser(userId) {
  const res = await fetch(`${API_URL}/follow/${userId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    credentials: 'include'
  });
  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

export async function unfollowUser(userId) {
  const res = await fetch(`${API_URL}/unfollow/${userId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    credentials: 'include'
  });
  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

export async function addFriend(userId) {
  const res = await fetch(`${API_URL}/friend/request/${userId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    credentials: 'include'
  });
  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

export async function unfriend(userId) {
  const res = await fetch(`${API_URL}/friend/remove/${userId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    credentials: 'include'
  });
  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}
