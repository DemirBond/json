import { StyleSheet, FlatList, View, TouchableOpacity, Platform, SafeAreaView, ActivityIndicator, Text } from 'react-native';
import { useEffect, useState } from 'react';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { router } from 'expo-router';
import { useEvaluation } from '../../contexts/EvaluationContext';

// Simple date formatting function to replace date-fns
const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[date.getMonth()];
  const day = date.getDate();
  const year = date.getFullYear();
  return `${month} ${day}, ${year}`;
};

const getGenderText = (gender: number): string => {
  return gender === 1 ? 'Male' : 'Female';
};

export default function HomeScreen() {
  const { evaluations, isLoading, error, fetchEvaluations } = useEvaluation();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchEvaluations();
  }, []);

  const handleAddEvaluation = () => {
    router.push('/add-evaluation');
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchEvaluations();
    } finally {
      setRefreshing(false);
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity 
      style={styles.personItem}
      onPress={() => {
        router.push({
          pathname: '/evaluation-details',
          params: { id: item.ID }
        });
      }}
    >
      <View style={styles.personInfo}>
        <ThemedText style={styles.nameText}>{item.Name}</ThemedText>
        <View style={styles.personDetails}>
          <ThemedText style={styles.detailText}>
            {getGenderText(item.gender)}, {item.age} years
          </ThemedText>
          <ThemedText style={styles.detailText}>
            BP: {item.SBP}/{item.DBP} mmHg
          </ThemedText>
        </View>
        <View style={styles.evaluationDetails}>
          <ThemedText style={styles.dateText}>
            Created: {formatDate(item.createdate)}
          </ThemedText>
          <ThemedText style={styles.evaluatorText}>
            By: {item.evaluatedBy}
          </ThemedText>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (isLoading && !refreshing) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.container}>
          <ActivityIndicator size="large" color="#4A90E2" />
        </ThemedView>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.container}>
          <Text style={styles.errorText}>{error}</Text>
        </ThemedView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ThemedView style={styles.container}>
        <ThemedView style={styles.header}>
          <ThemedText type="title">Evaluation List</ThemedText>
          <ThemedText style={styles.subtitle}>
            {evaluations.length} evaluations in the database
          </ThemedText>
        </ThemedView>
        
        <FlatList
          data={evaluations}
          renderItem={renderItem}
          keyExtractor={(item) => item.ID.toString()}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          refreshing={refreshing}
          onRefresh={onRefresh}
          ListEmptyComponent={
            refreshing ? (
              <View style={styles.refreshContainer}>
                <ActivityIndicator size="small" color="#4A90E2" />
              </View>
            ) : null
          }
        />

        <TouchableOpacity
          style={styles.fab}
          onPress={handleAddEvaluation}
          activeOpacity={0.8}
        >
          <IconSymbol name="plus" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#000',
  },
  container: {
    flex: 1,
    padding: 20,
  },
  header: {
    marginBottom: 20,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 5,
  },
  listContainer: {
    paddingBottom: 20,
  },
  personItem: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
  },
  personInfo: {
    flex: 1,
  },
  personDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 5,
  },
  evaluationDetails: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailText: {
    fontSize: 14,
    color: '#666',
  },
  dateText: {
    fontSize: 12,
    color: '#666',
  },
  evaluatorText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  nameText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4A90E2',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  errorText: {
    color: 'red',
    textAlign: 'center',
    marginTop: 20,
  },
  refreshContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
