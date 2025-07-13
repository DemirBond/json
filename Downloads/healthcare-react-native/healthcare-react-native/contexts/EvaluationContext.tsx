import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Evaluation = {
  platform: number;
  PatientId: number;
  ID: number;
  IsPAH: number;
  ForHF: number;
  Name: string;
  createdate: string;
  SBP: number;
  DBP: number;
  gender: number;
  inputs: string;
  age: number;
  evaluatedBy: string;
  UserId: string | null;
};

type EvaluationContextType = {
  evaluations: Evaluation[];
  isLoading: boolean;
  error: string | null;
  fetchEvaluations: () => Promise<void>;
};

const EvaluationContext = createContext<EvaluationContextType | undefined>(undefined);

export function EvaluationProvider({ children }: { children: React.ReactNode }) {
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEvaluations = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const token = await AsyncStorage.getItem('userToken');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(
        'https://cvdevaluator-api-alpha.azurewebsites.net/api/v1/Values/GetAllEvaluations?filterForUser=true',
        {
          method: 'GET',
          headers: {
            'accept': '*/*',
            'Authorization': `Bearer ${token}`
          }
        }
      );

      // Check if the response is empty before parsing
      const responseText = await response.text();
      if (!responseText || responseText.trim() === '') {
        console.error('Empty response received from API');
        throw new Error('Server returned an empty response');
      }

      // Safely parse JSON
      let data;
      try {
        data = JSON.parse(responseText);
        console.log('Evaluation Response Data:', data);
      } catch (parseError) {
        console.error('JSON Parse Error:', parseError);
        throw new Error('Failed to parse server response as JSON');
      }

      if (!response.ok) {
        console.error('Evaluation API Error:', {
          status: response.status,
          statusText: response.statusText,
          errorData: data
        });
        throw new Error(data.message || `Failed to fetch evaluations: ${response.status} ${response.statusText}`);
      }

      // Check if the response has the expected structure
      if (!data.evals || !Array.isArray(data.evals)) {
        console.error('Unexpected response format:', data);
        throw new Error('Invalid response format from server');
      }

      setEvaluations(data.evals);
    } catch (error) {
      console.error('Error fetching evaluations:', {
        error: error,
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      setError(error instanceof Error ? error.message : 'Failed to fetch evaluations');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <EvaluationContext.Provider value={{ evaluations, isLoading, error, fetchEvaluations }}>
      {children}
    </EvaluationContext.Provider>
  );
}

export function useEvaluation() {
  const context = useContext(EvaluationContext);
  if (context === undefined) {
    throw new Error('useEvaluation must be used within an EvaluationProvider');
  }
  return context;
} 