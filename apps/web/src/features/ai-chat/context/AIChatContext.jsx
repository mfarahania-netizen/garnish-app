import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { processQuery, initAIEngine } from '../services/aiEngine';
import { getTimeBasedContext, getSeasonContext } from '../services/personalizationService';
import { useRecipeContext } from '../../../context/RecipeContext';

const AIChatContext = createContext();
export const useAIChatContext = () => useContext(AIChatContext);

export const AIChatProvider = ({ children }) => {
  const { recipes } = useRecipeContext();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  // Ephemeral, in-memory preferences only (no localStorage store — RESET-01 / Amendment 2 §A2.3).
  // Real personalization context comes from the server (/ai/chat BehavioralContextSnapshot orchestrator).
  const [preferences, setPreferences] = useState({});
  const messagesEndRef = useRef(null);

  // راه‌اندازی موتور RAG با رسپی‌ها
  useEffect(() => {
    if (recipes.length > 0) {
      initAIEngine(recipes);
    }
  }, [recipes]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const addMessage = useCallback((role, content, extra = {}) => {
    const newMessage = {
      id: Date.now().toString(),
      role,
      content,
      timestamp: new Date().toISOString(),
      ...extra,
    };
    setMessages(prev => [...prev, newMessage]);
    return newMessage;
  }, []);

  const sendMessage = useCallback(async (text, imageData = null) => {
    if (!text?.trim() && !imageData) return;

    // Image/vision flow removed (no real photo recognition available).
    const userContent = text;

    addMessage('user', userContent, { imageData });

    setLoading(true);

    const timeContext = getTimeBasedContext();
    const seasonContext = getSeasonContext();
    const enrichedPrefs = {
      ...preferences,
      timeContext,
      seasonContext,
    };

    let queryText = text;
    if (imageData?.ingredients?.length) {
      queryText = imageData.ingredients.join('، ') + (text ? ` - ${text}` : ' - چی بپزم؟');
    }

    try {
      // اصلاح: await اضافه شد
      const response = await processQuery(queryText, recipes, enrichedPrefs);

      addMessage('assistant', response.message, {
        recipes: response.recipes,
        recipeFound: response.recipeFound,
        recipe: response.recipe,
        tips: response.tips,
        substitutes: response.substitutes,
        plan: response.plan,
        searchMethod: response.searchMethod,
      });
    } catch (error) {
      console.error('AI Engine error:', error);
      addMessage('assistant', 'متأسفانه خطایی رخ داد. لطفاً دوباره تلاش کنید.');
    }

    setLoading(false);
    scrollToBottom();
  }, [recipes, preferences, addMessage]);

  const clearChat = useCallback(() => {
    setMessages([]);
  }, []);

  return (
    <AIChatContext.Provider value={{
      messages,
      loading,
      sendMessage,
      clearChat,
      addMessage,
      preferences,
      setPreferences,
      messagesEndRef,
    }}>
      {children}
    </AIChatContext.Provider>
  );
};