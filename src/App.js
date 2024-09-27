import React, { useState, useEffect } from "react";
import { FaBook, FaCheck, FaRandom, FaUpload, FaClock, FaTrophy, FaExchangeAlt, FaTrash } from "react-icons/fa";
import { motion } from "framer-motion";
import axios from "axios";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs, updateDoc, doc, deleteDoc, getDoc } from "firebase/firestore";
import { db } from "./firebase";


const BookTracker = () => {
  const [userBooks, setUserBooks] = useState([]);
  const [girlfriendBooks, setGirlfriendBooks] = useState([]);
  const [ownedBooks, setOwnedBooks] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [countdown, setCountdown] = useState(null);
  const [completedBooks, setCompletedBooks] = useState({
    user: [],
    girlfriend: []
  });

  useEffect(() => {
    assignBooks();
  }, []);
  useEffect(() => {
    const fetchBooks = async () => {
      try {
        const ownedBooksSnapshot = await getDocs(collection(db, "ownedBooks"));
        const ownedBooksList = ownedBooksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setOwnedBooks(ownedBooksList);
  
        const assignedBooksSnapshot = await getDocs(collection(db, "assignedBooks"));
        const assignedBooksList = assignedBooksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setUserBooks(assignedBooksList.filter(book => book.assignedTo === "User"));
        setGirlfriendBooks(assignedBooksList.filter(book => book.assignedTo === "Girlfriend"));
  
        const completedBooksSnapshot = await getDocs(collection(db, "completedBooks"));
        const completedBooksList = completedBooksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setCompletedBooks({
          user: completedBooksList.filter(book => book.completedBy === "User"),
          girlfriend: completedBooksList.filter(book => book.completedBy === "Girlfriend")
        });
      } catch (error) {
        console.error("Error fetching books: ", error);
      }
    };
  
    fetchBooks();
  }, []);
  useEffect(() => {
    if (countdown) {
      const timer = setInterval(() => {
        setCountdown(prevCountdown => {
          if (prevCountdown <= 0) {
            clearInterval(timer);
            return 0;
          }
          return prevCountdown - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [countdown]);

  const assignBooks = async () => {
    setIsLoading(true);
    if (ownedBooks.length < 2) {
      // alert("You need at least 2 owned books to generate assignments.");
      setIsLoading(false);
      return;
    }
  
    const availableBooks = ownedBooks.filter(book => 
      !completedBooks.user.some(completedBook => completedBook.id === book.id) &&
      !completedBooks.girlfriend.some(completedBook => completedBook.id === book.id)
    );
    const shuffled = [...availableBooks].sort(() => 0.5 - Math.random());
    const newUserBooks = shuffled.slice(0, 2);
    const newGirlfriendBooks = shuffled.slice(2, 4);
  
    try {
      await Promise.all(newUserBooks.map(book => 
        addDoc(collection(db, "assignedBooks"), { ...book, assignedTo: "User" })
      ));
      await Promise.all(newGirlfriendBooks.map(book => 
        addDoc(collection(db, "assignedBooks"), { ...book, assignedTo: "Girlfriend" })
      ));
  
      setUserBooks(newUserBooks);
      setGirlfriendBooks(newGirlfriendBooks);
      setCountdown(30 * 24 * 60 * 60); // 30 days in seconds
    } catch (error) {
      console.error("Error assigning books: ", error);
    }
  
    setIsLoading(false);
  };
  const markAsCompleted = async (id, isUser) => {
    const completedBook = isUser 
      ? userBooks.find(book => book.id === id) 
      : girlfriendBooks.find(book => book.id === id);
  
    if (completedBook) {
      try {
        await addDoc(collection(db, "completedBooks"), { ...completedBook, completedBy: isUser ? "User" : "Girlfriend" });
        if (isUser) {
          setUserBooks(prevBooks => prevBooks.map(book => book.id === id ? { ...book, completed: true } : book));
          setCompletedBooks(prev => ({ ...prev, user: [...prev.user, completedBook] }));
        } else {
          setGirlfriendBooks(prevBooks => prevBooks.map(book => book.id === id ? { ...book, completed: true } : book));
          setCompletedBooks(prev => ({ ...prev, girlfriend: [...prev.girlfriend, completedBook] }));
        }
      } catch (error) {
        console.error("Error marking book as completed: ", error);
      }
    }
  };

  const checkAndReassignBooks = () => {
    const allUserBooksCompleted = userBooks.every(book => book.completed);
    const allGirlfriendBooksCompleted = girlfriendBooks.every(book => book.completed);

    if (allUserBooksCompleted && allGirlfriendBooksCompleted) {
      assignBooks();
    } else if (allUserBooksCompleted) {
      const availableBooks = ownedBooks.filter(book => 
        !completedBooks.user.some(completedBook => completedBook.id === book.id) &&
        !girlfriendBooks.some(girlfriendBook => girlfriendBook.id === book.id)
      );
      if (availableBooks.length > 0) {
        const newUserBook = availableBooks[Math.floor(Math.random() * availableBooks.length)];
        setUserBooks([newUserBook, ...userBooks.filter(book => !book.completed)]);
      }
    } else if (allGirlfriendBooksCompleted) {
      const availableBooks = ownedBooks.filter(book => 
        !completedBooks.girlfriend.some(completedBook => completedBook.id === book.id) &&
        !userBooks.some(userBook => userBook.id === book.id)
      );
      if (availableBooks.length > 0) {
        const newGirlfriendBook = availableBooks[Math.floor(Math.random() * availableBooks.length)];
        setGirlfriendBooks([newGirlfriendBook, ...girlfriendBooks.filter(book => !book.completed)]);
      }
    }
  };

  const searchBooks = async () => {
    try {
      const response = await axios.get(
        `https://www.googleapis.com/books/v1/volumes?q=${searchTerm}`
      );
      setSearchResults(response.data.items || []);
    } catch (error) {
      console.error("Error searching books:", error);
    }
  };

  const addOwnedBook = async (book) => {
    const newBook = {
      title: book.volumeInfo.title,
      author: book.volumeInfo.authors ? book.volumeInfo.authors[0] : "Unknown",
      description: book.volumeInfo.description || "No description available",
      imageUrl: book.volumeInfo.imageLinks?.thumbnail || "default-image-url"
    };
  
    try {
      await addDoc(collection(db, "ownedBooks"), newBook);
      setOwnedBooks([...ownedBooks, newBook]);
    } catch (error) {
      console.error("Error adding book: ", error);
    }
    setSearchResults([]);
    setSearchTerm("");

  };


  const addBookToReadingList = (newBook) => {
    setOwnedBooks((prevBooks) => {
      const isBookAlreadyInList = prevBooks.some(book => book.id === newBook.id);
  
      if (isBookAlreadyInList) {
        console.log("This book is already in the reading list.");
        return prevBooks; // No lo agregamos si ya existe
      }
  
      return [...prevBooks, newBook]; // Solo agregamos si no está duplicado
    });
  };
  const deleteOwnedBook = async (id) => {
    try {
      // Asegúrate de que este es el path correcto en Firestore
      const bookRef = doc(db, 'ownedBooks', id);
  
      // Verifica si el documento existe antes de eliminarlo
      const bookSnapshot = await getDoc(bookRef);
  
      if (!bookSnapshot.exists()) {
        console.error("El libro no fue encontrado en Firestore.");
        return;
      }
  
      // Procede a eliminar el documento
      await deleteDoc(bookRef);
      console.log(`Libro con ID ${id} eliminado exitosamente de Firebase`);
  
      // Actualiza el estado en la interfaz de usuariofa
      setOwnedBooks(prevBooks => prevBooks.filter(book => book.id !== id));
  
    } catch (error) {
      console.error("Error al intentar eliminar el libro de Firebase:", error);
    }
  };

  const formatTime = (seconds) => {
    const days = Math.floor(seconds / (24 * 60 * 60));
    const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((seconds % (60 * 60)) / 60);
    const secs = seconds % 60;
    return `${days}d ${hours}h ${minutes}m ${secs}s`;
  };

  const exchangeBook = (id, isUser) => {
    if (isUser) {
      const bookToExchange = userBooks.find(book => book.id === id);
      setUserBooks(prevBooks => prevBooks.filter(book => book.id !== id));
      setGirlfriendBooks(prevBooks => [...prevBooks, { ...bookToExchange, completed: false }]);
    } else {
      const bookToExchange = girlfriendBooks.find(book => book.id === id);
      setGirlfriendBooks(prevBooks => prevBooks.filter(book => book.id !== id));
      setUserBooks(prevBooks => [...prevBooks, { ...bookToExchange, completed: false }]);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-12 text-indigo-600">
          Book Tracker
        </h1>

        <div className="mb-8 text-center">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="bg-indigo-500 text-white px-6 py-3 rounded-full font-semibold shadow-lg hover:bg-indigo-600 transition duration-300 flex items-center justify-center mx-auto"
            onClick={assignBooks}
            disabled={isLoading}
          >
            {isLoading ? (
              <svg
                className="animate-spin h-5 w-5 mr-3 text-white"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
            ) : (
              <FaRandom className="mr-2" />
            )}
            {isLoading ? "Assigning Books..." : "Generate New Assignments"}
          </motion.button>
        </div>

        {countdown !== null && (
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-semibold mb-2 text-gray-800 flex items-center justify-center">
              <FaClock className="mr-2" /> Time Remaining
            </h2>
            <p className="text-3xl font-bold text-indigo-600">{formatTime(countdown)}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          <BookSection
            title="Facu Books"
            books={userBooks}
            markAsCompleted={(id) => markAsCompleted(id, true)}
            exchangeBook={(id) => exchangeBook(id, true)}
          />
          <BookSection
            title="Luna's Books"
            books={girlfriendBooks}
            markAsCompleted={(id) => markAsCompleted(id, false)}
            exchangeBook={(id) => exchangeBook(id, false)}
          />
        </div>

        <div className="bg-white shadow-md rounded-lg p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-gray-800 flex items-center">
            <FaUpload className="mr-2" /> Upload Owned Books
          </h2>
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search for a book..."
              className="flex-grow px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              onClick={searchBooks}
              className="bg-indigo-500 text-white px-6 py-2 rounded-md hover:bg-indigo-600 transition duration-300"
            >
              Search
            </button>
          </div>
          {searchResults.length > 0 && (
            <ul className="space-y-4">
              {searchResults.map((book) => (
                <li
                  key={book.id}
                  className="flex items-center justify-between bg-gray-50 p-4 rounded-md"
                >
                  <div className="flex items-center">
                    <img
                      src={
                        book.volumeInfo.imageLinks
                          ? book.volumeInfo.imageLinks.thumbnail
                          : "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=2730&q=80"
                      }
                      alt={book.volumeInfo.title}
                      className="w-16 h-24 object-cover rounded-md mr-4"
                    />
                    <div>
                      <h3 className="font-semibold">{book.volumeInfo.title}</h3>
                      <p className="text-sm text-gray-600">
                        {book.volumeInfo.authors
                          ? book.volumeInfo.authors.join(", ")
                          : "Unknown Author"}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => addOwnedBook(book)}
                    className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 transition duration-300"
                  >
                    Add
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {ownedBooks.length > 0 && (
          <div className="bg-white shadow-md rounded-lg p-6 mb-8">
            <h2 className="text-2xl font-semibold mb-4 text-gray-800 flex items-center">
              <FaBook className="mr-2" /> Your Owned Books
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {ownedBooks.map((book) => (
                <div
                  key={book.id}
                  className="bg-gray-50 p-4 rounded-md flex flex-col relative"
                >
                  <img
                    src={book.imageUrl}
                    alt={book.title}
                    className="w-full h-48 object-cover rounded-md mb-4"
                  />
                  <h3 className="font-semibold mb-1">{book.title}</h3>
                  <p className="text-sm text-gray-600 mb-2">{book.author}</p>
                  <p className="text-xs text-gray-500 flex-grow">
                    {book.description.length > 100
                      ? book.description.substring(0, 100) + "..."
                      : book.description}
                  </p>
                  <button
                    onClick={() => deleteOwnedBook(book.id)}
                    className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full hover:bg-red-600 transition duration-300"
                  >
                    <FaTrash />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {(completedBooks.user.length > 0 || completedBooks.girlfriend.length > 0) && (
          <div className="bg-white shadow-md rounded-lg p-6 mb-8">
            <h2 className="text-2xl font-semibold mb-4 text-gray-800 flex items-center">
              <FaTrophy className="mr-2" /> Completed Books
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <CompletedBooksSection
                title="Facu Completed Books"
                books={completedBooks.user}
                count={completedBooks.user.length}
              />
              <CompletedBooksSection
                title="Luna's Completed Books"
                books={completedBooks.girlfriend}
                count={completedBooks.girlfriend.length}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const BookSection = ({ title, books, markAsCompleted, exchangeBook }) => (
  <div className="bg-white shadow-md rounded-lg overflow-hidden">
    <div className="bg-indigo-600 text-white py-4 px-6">
      <h2 className="text-xl font-semibold flex items-center">
        <FaBook className="mr-2" /> {title}
      </h2>
    </div>
    <ul className="divide-y divide-gray-200">
      {books.map((book) => (
        <li key={book.id} className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-medium text-gray-900 truncate">
                {book.title}
              </h3>
              <p className="text-sm text-gray-500">{book.author}</p>
            </div>
            <div className="flex items-center space-x-2">
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className={`inline-flex items-center px-3 py-1 border border-transparent text-sm leading-5 font-medium rounded-full shadow-sm ${book.completed
                    ? "bg-green-100 text-green-800"
                    : "bg-indigo-100 text-indigo-800 hover:bg-indigo-200"
                  } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
                onClick={() => markAsCompleted(book.id)}
                disabled={book.completed}
              >
                {book.completed ? (
                  <>
                    <FaCheck className="mr-1" /> Completed
                  </>
                ) : (
                  "Mark as Completed"
                )}
              </motion.button>
              {!book.completed && (
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className="inline-flex items-center px-3 py-1 border border-transparent text-sm leading-5 font-medium rounded-full shadow-sm bg-yellow-100 text-yellow-800 hover:bg-yellow-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
                  onClick={() => exchangeBook(book.id)}
                >
                  <FaExchangeAlt className="mr-1" /> Exchange
                </motion.button>
              )}
            </div>
          </div>
          <p className="mt-2 text-sm text-gray-600">{book.description}</p>
        </li>
      ))}
    </ul>
  </div>
);

const CompletedBooksSection = ({ title, books, count }) => (
  <div className="bg-white shadow-md rounded-lg overflow-hidden">
    <div className="bg-green-600 text-white py-4 px-6">
      <h2 className="text-xl font-semibold flex items-center justify-between">
        <span>
          <FaTrophy className="mr-2 inline" /> {title}
        </span>
        <span className="text-sm bg-white text-green-600 px-2 py-1 rounded-full">
          {count} book{count !== 1 ? "s" : ""} completed
        </span>
      </h2>
    </div>
    <ul className="divide-y divide-gray-200">
      {books.map((book) => (
        <li key={book.id} className="p-4 hover:bg-gray-50">
          <div className="flex items-center space-x-4">
            <img
              src={book.imageUrl}
              alt={book.title}
              className="w-16 h-24 object-cover rounded-md"
            />
            <div>
              <h3 className="text-lg font-medium text-gray-900">{book.title}</h3>
              <p className="text-sm text-gray-500">{book.author}</p>
            </div>
          </div>
        </li>
      ))}
    </ul>
  </div>
);

export default BookTracker;
