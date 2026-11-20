import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { BookReaderExperience } from '@/features/library/BookReaderExperience';
export default function BookRoute(){const {bookId}=useLocalSearchParams<{bookId:string}>();return <BookReaderExperience bookId={String(bookId??'')}/>;}
