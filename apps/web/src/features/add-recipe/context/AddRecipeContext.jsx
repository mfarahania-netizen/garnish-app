import { createContext, useContext, useState, useCallback } from 'react';
import apiClient from '../../../lib/apiClient'; // جایگزین axios
import { useAuth } from '../../../context/AuthContext';

const AddRecipeContext = createContext();
export const useAddRecipe = () => useContext(AddRecipeContext);

export const AddRecipeProvider = ({ children }) => {
  const { token } = useAuth();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [cookingTime, setCookingTime] = useState('');
  const [servings, setServings] = useState('');
  const [prepTime, setPrepTime] = useState('');
  const [totalTime, setTotalTime] = useState('');
  const [mealType, setMealType] = useState([]);
  const [diet, setDiet] = useState('');
  const [cost, setCost] = useState('');
  const [ingredients, setIngredients] = useState([]);
  const [steps, setSteps] = useState([]);
  const [tools, setTools] = useState([]);
  const [tips, setTips] = useState([]);
  const [faq, setFaq] = useState([]);
  const [categories, setCategories] = useState([]);
  const [allergens, setAllergens] = useState([]);
  const [occasion, setOccasion] = useState([]);
  const [region, setRegion] = useState('');

  const submitRecipe = useCallback(async () => {
    if (!token) {
      alert('لطفاً وارد حساب کاربری خود شوید.');
      return null;
    }

    const recipeData = {
      title,
      description,
      category,
      difficulty,
      cookingTime: cookingTime ? parseInt(cookingTime) : null,
      servings: servings ? parseInt(servings) : null,
      prepTime,
      totalTime,
      mealType: mealType.join(','),
      diet,
      cost,
      region,
      tools,
      tips,
      faq,
      categories,
      allergens,
      occasion,
      ingredients,
      steps,
    };

    try {
      const res = await apiClient.post('/recipes', recipeData);
      return res.data;
    } catch (err) {
      console.error('خطا در ثبت رسپی:', err);
      alert('متأسفانه خطایی رخ داد.');
      return null;
    }
  }, [token, title, description, category, difficulty, cookingTime, servings, prepTime, totalTime, mealType, diet, cost, region, tools, tips, faq, categories, allergens, occasion, ingredients, steps]);

  return (
    <AddRecipeContext.Provider value={{
      title, setTitle,
      description, setDescription,
      category, setCategory,
      difficulty, setDifficulty,
      cookingTime, setCookingTime,
      servings, setServings,
      prepTime, setPrepTime,
      totalTime, setTotalTime,
      mealType, setMealType,
      diet, setDiet,
      cost, setCost,
      region, setRegion,
      ingredients, setIngredients,
      steps, setSteps,
      tools, setTools,
      tips, setTips,
      faq, setFaq,
      categories, setCategories,
      allergens, setAllergens,
      occasion, setOccasion,
      submitRecipe
    }}>
      {children}
    </AddRecipeContext.Provider>
  );
};

export { useAddRecipe as useAddRecipeContext };