import React from 'react';
import { CommentsScreen } from '../../comments/[contentId]';

export default function GeneralCommentsScreen() {
  return <CommentsScreen forcedScope="general" />;
}
