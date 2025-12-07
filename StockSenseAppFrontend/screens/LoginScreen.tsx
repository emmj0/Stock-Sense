import React, { useState } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, 
  Image, Alert, KeyboardAvoidingView, Platform, ScrollView, Dimensions 
} from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../config';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import Animated, { FadeInDown } from 'react-native-reanimated';

const { width } = Dimensions.get('window');

type LoginScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Login'>;

interface Props {
  navigation: LoginScreenNavigationProp;
}

export default function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    try {
      const res = await axios.post(`${API_URL}/api/auth/login`, { email, password });
      if (res?.data?.token) {
        await AsyncStorage.setItem('token', res.data.token);
        navigation.replace('Dashboard');
      } else {
        Alert.alert('Login Failed', 'No token received');
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Invalid credentials';
      Alert.alert('Login Failed', msg);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1, backgroundColor: '#f7f9fc' }} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <Animated.View entering={FadeInDown.duration(800).springify()}>
          <Image source={require('../assets/logo.png')} style={styles.logo} />
        </Animated.View>

        <Animated.View 
          entering={FadeInDown.delay(200).duration(800).springify()} 
          style={styles.card}
        >
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Log in to your StockSense account</Text>

          <TextInput
            placeholder="Email"
            placeholderTextColor="#999"
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
          />
          <TextInput
            placeholder="Password"
            placeholderTextColor="#999"
            style={styles.input}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <TouchableOpacity style={styles.button} onPress={handleLogin}>
            <Text style={styles.buttonText}>Log In</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
            <Text style={styles.link}>
              Don’t have an account? <Text style={styles.linkBold}>Sign Up</Text>
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    minHeight: Dimensions.get('window').height,
  },
  logo: {
    width: width < 600 ? 120 : 150,
    height: width < 600 ? 120 : 150,
    resizeMode: 'contain',
    alignSelf: 'center',
    marginBottom: 30,
  },
  card: {
    width: width < 600 ? '100%' : 400,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 25,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  title: { fontSize: 28, fontWeight: '700', textAlign: 'center', marginBottom: 8, color: '#1b1b1b' },
  subtitle: { fontSize: 15, textAlign: 'center', color: '#666', marginBottom: 20 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 14,
    marginBottom: 15,
    backgroundColor: '#fafafa',
    fontSize: 16,
  },
  button: {
    backgroundColor: '#007bff',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 5,
    shadowColor: '#007bff',
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  link: { marginTop: 15, textAlign: 'center', color: '#666' },
  linkBold: { color: '#007bff', fontWeight: '600' },
});
