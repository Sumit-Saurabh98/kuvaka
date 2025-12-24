'use client';

import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '../lib/auth-context';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';

export default function Home() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  // Redirect authenticated users to chat
  useEffect(() => {
    if (isAuthenticated) {
      router.push('/chat');
    }
  }, [isAuthenticated, router]);

  // Don't render if authenticated (will redirect)
  if (isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Header */}
      <header className="container mx-auto px-4 py-6">
        <nav className="flex items-center justify-between">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            Kuvaka
          </div>
          <Button
            onClick={() => router.push('/auth')}
            variant="outline"
            className="hidden sm:inline-flex"
          >
            Get Started
          </Button>
        </nav>
      </header>

      {/* Hero Section */}
      <main className="container mx-auto px-4 py-12">
        <div className="text-center max-w-4xl mx-auto">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-5xl md:text-7xl font-bold text-gray-900 dark:text-white mb-6"
          >
            Your AI Chat
            <span className="text-blue-600 dark:text-blue-400"> Companion</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto"
          >
            Experience intelligent conversations with our advanced AI assistant.
            Get instant answers, creative help, and meaningful discussions.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
          >
            <Button
              onClick={() => router.push('/auth')}
              size="lg"
              className="px-8 py-3 text-lg"
            >
              Start Chatting
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="px-8 py-3 text-lg"
              onClick={() => router.push('/auth')}
            >
              Learn More
            </Button>
          </motion.div>
        </div>

        {/* Features */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="grid md:grid-cols-3 gap-8 mt-20"
        >
          <Card className="text-center">
            <CardHeader>
              <CardTitle className="text-2xl">Intelligent Responses</CardTitle>
              <CardDescription>
                Get accurate, contextual answers powered by advanced AI
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-4xl mb-4">🧠</div>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <CardTitle className="text-2xl">Secure & Private</CardTitle>
              <CardDescription>
                Your conversations are protected with enterprise-grade security
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-4xl mb-4">🔒</div>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <CardTitle className="text-2xl">Always Available</CardTitle>
              <CardDescription>
                Chat with our AI anytime, anywhere, on any device
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-4xl mb-4">🌟</div>
            </CardContent>
          </Card>
        </motion.div>

        {/* CTA Section */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          className="text-center mt-20"
        >
          <Card className="max-w-2xl mx-auto bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-0">
            <CardContent className="p-8">
              <h3 className="text-3xl font-bold mb-4">Ready to Start?</h3>
              <p className="text-blue-100 mb-6">
                Join thousands of users who are already experiencing the future of AI conversation.
              </p>
              <Button
                onClick={() => router.push('/auth')}
                size="lg"
                variant="secondary"
                className="px-8 py-3 text-lg"
              >
                Get Started Now
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  );
}
