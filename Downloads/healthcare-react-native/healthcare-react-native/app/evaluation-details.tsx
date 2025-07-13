import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, SafeAreaView, Alert } from 'react-native';
import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { IconSymbol } from '@/components/ui/IconSymbol';

interface EvaluationDetail {
  ID: string;
  Name: string;
  age: number;
  gender: number;
  SBP: number;
  DBP: number;
  CvdResult: {
    status: string;
    message: string;
    Outputs: Array<{
      groupname: string;
      fields: Array<{
        par: string;
        val: string;
      }>;
    }>;
    EvaluationID: number;
  };
  createdate: string;
  inputs: string;
  userId: string;
  Dob: string;
  outputs: string | null;
  userDiagnostics: string;
  userTherapeutics: string;
  userTargets: string;
  userCitations: string;
  userICD: string;
  userAssessment: string;
  isPAH: number;
}

export default function EvaluationDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [evaluation, setEvaluation] = useState<EvaluationDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { getToken } = useAuth();
  const router = useRouter();

  const handleBack = () => {
    console.log('Back button pressed');
    router.push('/(tabs)');
  };

  useEffect(() => {
    const fetchEvaluationDetails = async () => {
      try {
        const token = await getToken();
        if (!token) {
          throw new Error('No authentication token found');
        }

        const response = await fetch(
          `https://cvdevaluator-api-alpha.azurewebsites.net/api/v1/Values/GetEvaluationById?id=${id}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'accept': 'text/plain'
            }
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Evaluation Details Response:', data);
        setEvaluation(data);
      } catch (err) {
        console.error('Error fetching evaluation details:', err);
        setError('Failed to load evaluation details');
      } finally {
        setIsLoading(false);
      }
    };

    fetchEvaluationDetails();
  }, [id]);

  const getGenderText = (gender: number): string => {
    return gender === 1 ? 'Male' : 'Female';
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    const day = date.getDate();
    const year = date.getFullYear();
    return `${month} ${day}, ${year}`;
  };

  const renderCvdResult = () => {
    if (!evaluation?.CvdResult?.Outputs) return null;

    return (
      <View style={styles.resultCard}>
        <Text style={styles.resultTitle}>CVD Result</Text>
        {evaluation.CvdResult.Outputs.map((output, index) => (
          <View key={index} style={styles.outputGroup}>
            <Text style={styles.outputGroupTitle}>{output.groupname}</Text>
            {output.fields.map((field, fieldIndex) => (
              <View key={fieldIndex} style={styles.outputField}>
                <Text style={styles.outputFieldLabel}>{field.par}:</Text>
                <Text style={styles.outputFieldValue}>{field.val}</Text>
              </View>
            ))}
          </View>
        ))}
      </View>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <ActivityIndicator size="large" color="#4A90E2" />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !evaluation) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <Text style={styles.errorText}>{error || 'Evaluation not found'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={handleBack}
          style={styles.backButton}
        >
          <IconSymbol name="chevron.left" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Evaluation Details</Text>
      </View>
      <ScrollView style={styles.container}>
        <View style={styles.content}>
          <View style={styles.patientInfo}>
            <Text style={styles.patientName}>{evaluation.Name}</Text>
            <View style={styles.patientDetails}>
              <Text style={styles.detailText}>
                {getGenderText(evaluation.gender)}, {evaluation.age} years
              </Text>
              <Text style={styles.detailText}>
                BP: {evaluation.SBP}/{evaluation.DBP} mmHg
              </Text>
            </View>
          </View>

          {renderCvdResult()}

          <View style={styles.metadataCard}>
            <View style={styles.metadataItem}>
              <Text style={styles.metadataLabel}>Date</Text>
              <Text style={styles.metadataValue}>{formatDate(evaluation.createdate)}</Text>
            </View>
            <View style={styles.metadataItem}>
              <Text style={styles.metadataLabel}>Patient ID</Text>
              <Text style={styles.metadataValue}>{evaluation.ID}</Text>
            </View>
            <View style={styles.metadataItem}>
              <Text style={styles.metadataLabel}>PAH Status</Text>
              <Text style={styles.metadataValue}>{evaluation.isPAH === 1 ? 'Yes' : 'No'}</Text>
            </View>
          </View>

          {evaluation.inputs && (
            <View style={styles.inputsCard}>
              <Text style={styles.inputsTitle}>Input Data</Text>
              <Text style={styles.inputsText}>{evaluation.inputs}</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#121212',
  },
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#1E1E1E',
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  backButton: {
    marginRight: 16,
    padding: 16,
    borderRadius: 25,
    backgroundColor: '#2A2A2A',
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#3A3A3A',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  content: {
    padding: 16,
  },
  patientInfo: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  patientName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  patientDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailText: {
    fontSize: 16,
    color: '#B0B0B0',
  },
  resultCard: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  outputGroup: {
    marginBottom: 16,
  },
  outputGroupTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  outputField: {
    marginBottom: 8,
  },
  outputFieldLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#B0B0B0',
    marginBottom: 4,
  },
  outputFieldValue: {
    fontSize: 16,
    color: '#FFFFFF',
    lineHeight: 24,
  },
  metadataCard: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  metadataItem: {
    marginBottom: 12,
  },
  metadataLabel: {
    fontSize: 14,
    color: '#B0B0B0',
    marginBottom: 4,
  },
  metadataValue: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  inputsCard: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  inputsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  inputsText: {
    fontSize: 16,
    color: '#B0B0B0',
    lineHeight: 24,
  },
  errorText: {
    color: '#FF6B6B',
    textAlign: 'center',
    marginTop: 20,
    fontSize: 16,
  },
}); 