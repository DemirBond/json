import { StyleSheet, TouchableOpacity, View, TextInput, ActivityIndicator, ScrollView, Alert, Platform, SafeAreaView, Modal, Switch, Text as RNText } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useEffect, useRef } from 'react';
import { ThemedText } from '@/components/ThemedText';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Audio } from 'expo-av';
import React from 'react';
import openai from '@/lib/openai';
import AsyncStorage from '@react-native-async-storage/async-storage';

// --- TypeScript Interfaces for API Interaction ---
interface ExtractedValue {
  api_key: string;
  value: any;
  // Add other potential fields if known from API docs, e.g., confidence_score, context
}

interface SuggestedQuestionOption {
  value: string; // The internal value to be sent back to the API
  text: string;  // The display text for the user
}

interface SuggestedQuestion {
  field_to_probe: string; // Key for the answer in follow_up_data
  question_text: string;
  input_type: 'boolean' | 'text' | 'number' | 'select';
  options?: SuggestedQuestionOption[]; // Only present if input_type is "select"
}

interface InteractiveExtractionResult {
  extracted_values: ExtractedValue[];
  suggested_follow_up_questions: SuggestedQuestion[];
  is_complete: boolean;
  // Optional: Add fields like 'message' or 'status_code' if API returns them
}
// --- End TypeScript Interfaces ---

export default function AddEvaluationScreen() {
  const router = useRouter();
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false); // General loading/processing state
  const [recordingTimer, setRecordingTimer] = useState(0);
  const [error, setError] = useState('');
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    age: '',
    gender: '1', // Default to male (1), female (2)
  });
  
  const [evaluationResult, setEvaluationResult] = useState<any>(null); // For "evaluate only" modal
  const [showResultModal, setShowResultModal] = useState(false);
  const [finalExtractedValuesForSave, setFinalExtractedValuesForSave] = useState<ExtractedValue[] | null>(null);

  // New state variables for interactive extraction
  const [originalTranscriptForFollowUp, setOriginalTranscriptForFollowUp] = useState('');
  const [suggestedQuestions, setSuggestedQuestions] = useState<SuggestedQuestion[]>([]);
  const [surveyAnswers, setSurveyAnswers] = useState<Record<string, any>>({}); // Stores answers: { field_to_probe: answerValue }
  const [showSurveyModal, setShowSurveyModal] = useState(false);
  const [pendingActionAfterExtraction, setPendingActionAfterExtraction] = useState<'save' | 'evaluate_only' | null>(null);
  const initialActionRef = useRef<'save' | 'evaluate_only' | null>(null); // Ref to store the initial action

  // Request microphone permissions on component mount
  useEffect(() => {
    (async () => {
      const { status } = await Audio.requestPermissionsAsync();
      setHasPermission(status === 'granted');
      if (status !== 'granted') {
        Alert.alert("Permission Required", "Microphone access is needed to record audio evaluations. Please enable it in your device settings.");
      }
    })();
  }, []);

  // Recording timer logic
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording) {
      interval = setInterval(() => setRecordingTimer(prev => prev + 1), 1000);
    } else {
      setRecordingTimer(0);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [isRecording]);

  const startRecording = async () => {
    if (hasPermission !== true) {
      Alert.alert('Permission Denied', 'Microphone access is required for recording. Please enable it in settings.');
      return;
    }
    try {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: newRecording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY); // Using preset for simplicity
      recordingRef.current = newRecording;
      setRecording(newRecording);
      setIsRecording(true);
      setError('');
      setTranscript(''); // Clear previous transcript
      setSuggestedQuestions([]); // Clear previous questions
      setSurveyAnswers({}); // Clear previous answers
    } catch (err) {
      console.error('Error starting recording:', err);
      setError('Failed to start recording.');
      Alert.alert('Recording Error', 'Failed to start recording. Please try again.');
    }
  };

  const stopRecording = async () => {
    if (!recordingRef.current) return;
    setIsRecording(false);
    setIsProcessing(true); // Indicate processing starts
    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      if (!uri) throw new Error('No recording URI available');
      await processAudioFile(uri); // This will set transcript and then setIsProcessing(false)
      recordingRef.current = null;
      setRecording(null);
    } catch (err) {
      console.error('Error stopping/processing recording:', err);
      setError('Failed to process recording.');
      Alert.alert('Processing Error', 'Failed to process the recording. Please try again.');
      setIsProcessing(false); // Ensure processing is false on error here
    }
  };

  const processAudioFile = async (uri: string) => {
    try {
      const fileData = new FormData();
      const fileExtension = uri.split('.').pop()?.toLowerCase() || 'm4a';
      const mimeType = Platform.OS === 'ios' ? 'audio/m4a' : 'audio/mp4'; // Common types, adjust if specific
      
      fileData.append('file', { uri, type: mimeType, name: `recording.${fileExtension}` } as any);
      fileData.append('model', 'gpt-4o-transcribe'); // As per original code
      fileData.append('prompt', "Always generate in english"); // As per original code
      
      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${openai.apiKey}` },
        body: fileData,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`OpenAI API error: ${errorData.error?.message || 'Unknown transcription error'}`);
      }
      const data = await response.json();
      setTranscript(data.text);
    } catch (err) {
      console.error('Error processing audio with OpenAI:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error during transcription.';
      setError(`Transcription failed: ${errorMessage}`);
      Alert.alert('Transcription Error', `Failed to convert speech to text. ${errorMessage}`);
    } finally {
      setIsProcessing(false); // Processing of audio file (transcription) is done
    }
  };

  const handleStartStopRecording = () => {
    if (isRecording) stopRecording();
    else startRecording();
  };
  
  const fetchInteractiveData = async (
    textToExtract: string, 
    followUpAnswers: Record<string, any> | null
  ): Promise<InteractiveExtractionResult | null> => {
    const requestBody: { text: string; follow_up_data?: Record<string, any> } = {
      text: textToExtract,
    };
    if (followUpAnswers && Object.keys(followUpAnswers).length > 0) { // only add if not null and not empty
      requestBody.follow_up_data = followUpAnswers;
    }

    try {
      const response = await fetch('http://cvdevaluator.com:8080/api/interactive_extraction/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'test-api-key-123', // As per briefing
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: "Unknown API error structure" }));
        throw new Error(`API Error (${response.status}): ${errorData.detail || 'Failed to extract data.'}`);
      }
      return await response.json() as InteractiveExtractionResult;
    } catch (err) {
      console.error('Error in fetchInteractiveData:', err);
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred during data extraction.';
      setError(errorMessage);
      Alert.alert('Extraction Error', errorMessage);
      return null;
    }
  };
  
  const startInteractiveExtractionProcess = async (action: 'save' | 'evaluate_only') => {
    // Validate patient form data
    if (!formData.name.trim()) {
      Alert.alert('Missing Information', 'Please enter the patient\'s name.');
      return;
    }
    if (!formData.age.trim() || isNaN(Number(formData.age)) || Number(formData.age) <= 0) {
      Alert.alert('Invalid Information', 'Please enter a valid age for the patient.');
      return;
    }
    if (!transcript.trim()) {
      Alert.alert('Missing Information', 'Please provide an evaluation transcript by recording audio or typing notes.');
      return;
    }

    setIsProcessing(true);
    setError('');
    setPendingActionAfterExtraction(action); // Keep this for survey flow state
    initialActionRef.current = action; // Store the initial action in ref
    setOriginalTranscriptForFollowUp(transcript); // Store current transcript for potential follow-up

    const result = await fetchInteractiveData(transcript, null); // Initial call, no follow_up_data

    if (result) {
      if (result.is_complete || !result.suggested_follow_up_questions || result.suggested_follow_up_questions.length === 0) {
        // No follow-up questions or already complete, proceed to finalize
        await finalizeEvaluation(result.extracted_values, action); // Pass action directly
      } else {
        // Questions suggested, show survey modal
        setSuggestedQuestions(result.suggested_follow_up_questions);
        setSurveyAnswers({}); // Reset answers for the new survey
        setShowSurveyModal(true);
        setIsProcessing(false); // Allow user interaction with the survey
      }
    } else {
      setIsProcessing(false); // Error already handled by fetchInteractiveData
      setPendingActionAfterExtraction(null); // Reset pending action on failure
    }
  };

  const handleSurveySubmission = async () => {
    setIsProcessing(true); // Indicate processing for survey submission
    setError('');

    const result = await fetchInteractiveData(originalTranscriptForFollowUp, surveyAnswers);
    setShowSurveyModal(false); // Hide modal after API call completes, regardless of outcome

    if (result) {
      // Expecting is_complete to be true now, and suggested_follow_up_questions to be empty
      await finalizeEvaluation(result.extracted_values, initialActionRef.current as 'save' | 'evaluate_only'); // Pass initialActionRef.current and assert type
    } else {
      setIsProcessing(false); // Error handled by fetchInteractiveData
      setPendingActionAfterExtraction(null); // Reset pending action on failure
    }
  };
  
  const finalizeEvaluation = async (finalExtractedValues: ExtractedValue[], action: 'save' | 'evaluate_only') => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) throw new Error('Authentication token not found. Please log in again.');

      const formattedString = finalExtractedValues.map(item => {
        if (typeof item.value === 'boolean') {
          // If boolean and true, include only the api_key
          // If boolean and false, exclude it (return null to be filtered out)
          return item.value ? item.api_key : null;
        }
        // For non-boolean values, format as api_key=value
        return `${item.api_key}=${item.value}`;
      }).filter(item => item !== null).join('|'); // Filter out nulls before joining

      let sbp = 120; // Default SBP
      let dbp = 70;  // Default DBP
      const sbpItem = finalExtractedValues.find(item => item.api_key === 'SBP');
      const dbpItem = finalExtractedValues.find(item => item.api_key === 'DBP');
      if (sbpItem && typeof sbpItem.value === 'number') sbp = sbpItem.value;
      if (dbpItem && typeof dbpItem.value === 'number') dbp = dbpItem.value;

      const baseEvaluationData = {
        Name: formData.name,
        FirstName: formData.name,
        IsPAH: false,
        age: parseInt(formData.age),
        gender: parseInt(formData.gender),
        SBP: sbp,
        DBP: dbp,
        Inputs: formattedString,
      };

      if (action === 'save') { // Use the passed action parameter
        const saveData = {
          ...baseEvaluationData,
          EvaluationID: 0,
          PatientId: 0,
          Dob: new Date().toISOString(),
        };
        const response = await fetch('https://cvdevaluator-api-alpha.azurewebsites.net/api/v1/Values/SaveEvaluation', {
          method: 'POST',
          headers: { 'accept': 'text/plain', 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(saveData),
        });
        const responseData = await response.json().catch(() => ({ message: "Error parsing save response"}));
        if (!response.ok) throw new Error(`Failed to save evaluation: ${responseData.message || 'Unknown server error'}`);
        Alert.alert('Success', 'Evaluation saved successfully!', [{ text: 'OK', onPress: () => router.back() }]);

      } else if (action === 'evaluate_only') { // Use the passed action parameter
        const evaluateData = {
          ...baseEvaluationData,
          UserId: "0",
          Platform: "0",
        };
        const response = await fetch('http://cvdevaluator.com:8080/api/evaluate/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': 'test-api-key-123', // Use the backend API key
          },
          body: JSON.stringify({
            ...evaluateData,
            auth_token: token, // Pass the external API token to the backend
          }),
        });
        const responseText = await response.text();
        if (!responseText.trim()) throw new Error('Server returned an empty response for evaluation.');
        const responseData = JSON.parse(responseText);
        if (!response.ok) throw new Error(`API error during evaluation: ${responseData.message || 'Unknown server error'}`);
        setEvaluationResult(responseData);
        setFinalExtractedValuesForSave(finalExtractedValues); // Capture extracted data for potential saving
        setShowResultModal(true);
      }
    } catch (err) {
      console.error(`Error in finalizeEvaluation (Action: ${action}):`, err); // Use the passed action parameter for logging
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred while finalizing the evaluation.';
      setError(errorMessage);
      Alert.alert('Finalization Error', errorMessage);
    } finally {
      setIsProcessing(false);
      // setPendingActionAfterExtraction(null); // Removed: state is needed for survey flow and reset at start of process
    }
  };

  const handleSave = async () => {
    if (finalExtractedValuesForSave === null) {
      Alert.alert("No evaluation data to save", "Please perform an evaluation first.");
      return;
    }
    setIsProcessing(true);
    setError('');
    await finalizeEvaluation(finalExtractedValuesForSave, 'save');
  };
  const evalWithoutSaving = () => startInteractiveExtractionProcess('evaluate_only');

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)'); // Fallback to home if no back history
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSurveyAnswerChange = (field: string, value: any) => {
    setSurveyAnswers(prev => ({ ...prev, [field]: value }));
  };

  const renderSurveyQuestion = (question: SuggestedQuestion, index: number) => {
    return (
      <View key={`${question.field_to_probe}_${index}`} style={styles.surveyQuestionContainer}>
        <ThemedText style={styles.surveyQuestionText}>{question.question_text}</ThemedText>
        
        {question.input_type === 'text' && (
          <TextInput
            style={styles.surveyInput}
            placeholderTextColor="#999"
            value={surveyAnswers[question.field_to_probe] || ''}
            onChangeText={(text) => handleSurveyAnswerChange(question.field_to_probe, text)}
            placeholder={`Enter ${question.field_to_probe}`} 
          />
        )}
        {question.input_type === 'number' && (
          <TextInput
            style={styles.surveyInput}
            placeholderTextColor="#999"
            keyboardType="numeric"
            value={surveyAnswers[question.field_to_probe] || ''}
            onChangeText={(text) => handleSurveyAnswerChange(question.field_to_probe, text)}
            placeholder={`Enter ${question.field_to_probe} (number)`}
          />
        )}
        {question.input_type === 'boolean' && (
          <View style={styles.surveyBooleanContainer}>
            <RNText style={styles.booleanLabel}>No</RNText> 
            <Switch
              value={!!surveyAnswers[question.field_to_probe]} 
              onValueChange={(val) => handleSurveyAnswerChange(question.field_to_probe, val)}
              trackColor={{ false: "#767577", true: "#4CAF50" }} 
              thumbColor={!!surveyAnswers[question.field_to_probe] ? "#f4f3f4" : "#f4f3f4"} 
            />
            <RNText style={styles.booleanLabel}>Yes</RNText>
          </View>
        )}
        {question.input_type === 'select' && question.options && (
          <View style={styles.surveySelectContainer}>
            {question.options.map(option => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.selectOptionButton,
                  surveyAnswers[question.field_to_probe] === option.value && styles.selectOptionButtonSelected
                ]}
                onPress={() => handleSurveyAnswerChange(question.field_to_probe, option.value)}
              >
                <ThemedText style={[
                  styles.selectOptionText,
                  surveyAnswers[question.field_to_probe] === option.value && styles.selectOptionTextSelected
                ]}>{option.text}</ThemedText>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  };

  const renderResultCard = (group: any) => ( 
    <View key={group.groupname} style={styles.resultCard}>
      <ThemedText style={styles.resultCardTitle}>{group.groupname}</ThemedText>
      {group.fields.map((field: any, idx: number) => (
        <View key={idx} style={styles.resultFieldItem}>
          <ThemedText style={styles.resultFieldValue}>{field.val}</ThemedText>
        </View>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <IconSymbol name="chevron.left" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>New Evaluation</ThemedText>
        <View style={styles.placeholder} /> 
      </View>

      <View style={styles.container}>
        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* Patient Information */}
          <View style={styles.formContainer}>
            <ThemedText style={styles.formLabel}>Patient Information</ThemedText>
            <View style={styles.inputContainer}>
              <ThemedText style={styles.inputLabel}>Name</ThemedText>
              <TextInput style={styles.input} value={formData.name} onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))} placeholder="Enter patient name" placeholderTextColor="#999" />
            </View>
            <View style={styles.inputContainer}>
              <ThemedText style={styles.inputLabel}>Age</ThemedText>
              <TextInput style={styles.input} value={formData.age} onChangeText={(text) => setFormData(prev => ({ ...prev, age: text }))} placeholder="Enter patient age" placeholderTextColor="#999" keyboardType="numeric" />
            </View>
            <View style={styles.inputContainer}>
              <ThemedText style={styles.inputLabel}>Gender</ThemedText>
              <View style={styles.genderContainer}>
                <TouchableOpacity style={[styles.genderButton, formData.gender === '1' && styles.genderButtonActive]} onPress={() => setFormData(prev => ({ ...prev, gender: '1' }))}>
                  <ThemedText style={[styles.genderButtonText, formData.gender === '1' && styles.genderButtonTextActive]}>Male</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.genderButton, formData.gender === '2' && styles.genderButtonActive]} onPress={() => setFormData(prev => ({ ...prev, gender: '2' }))}>
                  <ThemedText style={[styles.genderButtonText, formData.gender === '2' && styles.genderButtonTextActive]}>Female</ThemedText>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Recording & Transcript */}
          <ThemedText style={styles.instruction}>
            {isRecording ? `Recording... ${formatTime(recordingTimer)}` : "Tap microphone to record, or type notes below."}
          </ThemedText>
          
          {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : null}

          <View style={styles.transcriptContainer}>
            <ThemedText style={styles.transcriptLabel}>Evaluation Notes / Transcript</ThemedText>
            <TextInput
              style={styles.transcriptInput} multiline value={transcript}
              onChangeText={setTranscript} placeholder="Evaluation notes..."
              placeholderTextColor="#999"
            />
          </View>

          <TouchableOpacity 
            style={[styles.recordButton, isRecording && styles.recordButtonActive, (isProcessing && !isRecording) && styles.disabledButton]} 
            onPress={handleStartStopRecording} activeOpacity={0.8} 
            disabled={(isProcessing && !isRecording)} 
          >
            {(isProcessing && !isRecording && transcript === '') ? ( 
                <ActivityIndicator color="#FFFFFF" size="large" />
             ) : (
                <IconSymbol name="mic" size={30} color="#FFFFFF" />
             )}
          </TouchableOpacity>
        </ScrollView>

        {(transcript.trim() !== '' || isRecording) && (
          <View style={styles.actionButtonsContainer}>
            <TouchableOpacity
              style={[styles.evaluateButton, (isProcessing || isRecording) && styles.disabledButton]}
              onPress={evalWithoutSaving} disabled={isProcessing || isRecording}
            >
              {isProcessing && pendingActionAfterExtraction === 'evaluate_only' ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <IconSymbol name="chart.bar" size={20} color="#FFFFFF" />
                  <ThemedText style={styles.buttonText}>Evaluate</ThemedText>
                </>
              )}
            </TouchableOpacity>
            {evaluationResult !== null && (
              <TouchableOpacity
                style={[styles.saveButton, (isProcessing || isRecording) && styles.disabledButton]}
                onPress={handleSave} disabled={isProcessing || isRecording}
              >
                {isProcessing && pendingActionAfterExtraction === 'save' ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                   <IconSymbol name="square.and.arrow.down" size={20} color="#FFFFFF" />
                   <ThemedText style={styles.buttonText}>Save</ThemedText>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      <Modal
        visible={showSurveyModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => { if (!isProcessing) setShowSurveyModal(false); }} 
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Clarification Questions</ThemedText>
              <TouchableOpacity 
                style={styles.closeButton} 
                onPress={() => { if (!isProcessing) setShowSurveyModal(false); }}
                disabled={isProcessing}
              >
                <IconSymbol name="xmark" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
              {suggestedQuestions.map((q, i) => renderSurveyQuestion(q, i))}
            </ScrollView>
            <TouchableOpacity
              style={[styles.submitSurveyButton, isProcessing && styles.disabledButton]}
              onPress={handleSurveySubmission}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <ThemedText style={styles.submitSurveyButtonText}>Submit Answers</ThemedText>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showResultModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowResultModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Evaluation Results</ThemedText>
              <TouchableOpacity style={styles.closeButton} onPress={() => setShowResultModal(false)}>
                <IconSymbol name="xmark" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              {evaluationResult?.Outputs?.map((group: any, idx: number) => renderResultCard(group))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// --- Styles ---
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#1E1E1E',
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 0, 
    position: 'relative',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#1E1E1E',
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  backButton: {
    padding: 8, 
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center',
  },
  placeholder: {
    width: 40, 
  },
  content: {
    flex: 1,
  },
  instruction: {
    fontSize: 16,
    textAlign: 'center',
    marginVertical: 20,
    color: '#E0E0E0', 
  },
  errorText: {
    color: '#FF6B6B', 
    textAlign: 'center',
    marginBottom: 15,
    fontSize: 14,
  },
  formContainer: {
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 18,
    fontWeight: '600', 
    marginBottom: 16,
    color: '#FFFFFF',
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    marginBottom: 8,
    color: '#B0B0B0', 
  },
  input: {
    backgroundColor: '#333333',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: '#454545',
    color: '#FFFFFF',
    fontSize: 16,
  },
  genderContainer: {
    flexDirection: 'row',
  },
  genderButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#454545',
    alignItems: 'center',
    marginHorizontal: 4,
  },
  genderButtonActive: {
    backgroundColor: '#4A90E2',
    borderColor: '#4A90E2',
  },
  genderButtonText: {
    color: '#B0B0B0',
  },
  genderButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  transcriptContainer: {
    marginTop: 10,
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  transcriptLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    color: '#FFFFFF',
  },
  transcriptInput: {
    backgroundColor: '#333333',
    borderRadius: 8,
    padding: 15,
    minHeight: 150, 
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#454545',
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 22,
  },
  recordButton: {
    backgroundColor: '#4A90E2',
    borderRadius: 40, 
    width: 70,
    height: 70,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: 5, 
    marginBottom: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  recordButtonActive: {
    backgroundColor: '#E24A4A', 
  },
  actionButtonsContainer: {
    paddingVertical: 12,
    paddingHorizontal:10,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#333333',
    backgroundColor: '#1E1E1E', 
  },
  evaluateButton: {
    backgroundColor: '#28A745', // Green color for evaluate
    borderRadius: 10,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    flex: 1,
    marginHorizontal: 6,
    gap: 8,
  },
  saveButton: {
    backgroundColor: '#007BFF', // Blue color for save
    borderRadius: 10,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    flex: 1,
    marginHorizontal: 6,
    gap: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  disabledButton: {
    opacity: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)', 
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#2C2C2E', 
    borderRadius: 14,
    width: '100%',
    maxHeight: '85%',
    overflow: 'hidden',
    elevation: 10,
  },
  modalHeader: {
    backgroundColor: '#1C1C1E', 
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#3A3A3C', 
  },
  modalTitle: {
    fontSize: 17, 
    fontWeight: '600', 
    color: '#FFFFFF',
  },
  closeButton: {
    padding: 8,
  },
  modalBody: {
    paddingHorizontal: 16,
    paddingTop: 10, 
    paddingBottom: 16,
  },
  surveyQuestionContainer: {
    marginBottom: 20,
    padding: 12,
    backgroundColor: '#3A3A3C', 
    borderRadius: 10,
  },
  surveyQuestionText: {
    fontSize: 16,
    color: '#E0E0E0',
    marginBottom: 12,
    fontWeight: '500',
    lineHeight: 22,
  },
  surveyInput: {
    backgroundColor: '#1C1C1E', 
    color: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#48484A', 
  },
  surveyBooleanContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around', 
    paddingVertical: 8,
  },
  booleanLabel: {
    color: '#E0E0E0',
    fontSize: 16,
  },
  surveySelectContainer: {
    marginTop: 8,
  },
  selectOptionButton: {
    backgroundColor: '#1C1C1E',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#48484A',
  },
  selectOptionButtonSelected: {
    backgroundColor: '#007BFF', 
    borderColor: '#007BFF',
  },
  selectOptionText: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontSize: 16,
  },
  selectOptionTextSelected: {
    fontWeight: '600',
  },
  submitSurveyButton: {
    backgroundColor: '#007BFF', 
    paddingVertical: 16,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#3A3A3C'
  },
  submitSurveyButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
  resultCard: { 
    backgroundColor: '#3A3A3C',
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#007BFF', 
  },
  resultCardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#48484A',
    paddingBottom: 8,
  },
  resultFieldItem: {
    paddingVertical: 8,
  },
  resultFieldValue: {
    fontSize: 16,
    color: '#E0E0E0',
    lineHeight: 22,
  },
});