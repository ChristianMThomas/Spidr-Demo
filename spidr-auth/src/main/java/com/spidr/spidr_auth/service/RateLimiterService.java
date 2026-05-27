package com.spidr.spidr_auth.service;

import org.springframework.stereotype.Service;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Lightweight in-memory sliding-window rate limiter.
 * Keyed by an arbitrary string (e.g. "ip:endpoint").
 *
 * NOTE: this is per-instance memory — for multi-instance deployments
 * replace with a Redis-backed implementation.
 */
@Service
public class RateLimiterService {

    private final ConcurrentHashMap<String, Deque<Long>> requestLog = new ConcurrentHashMap<>();

    /**
     * Check and record a request against the rate limit.
     *
     * @param key         rate-limit bucket key, e.g. "192.168.1.1:login"
     * @param maxRequests maximum requests allowed within the window
     * @param windowSecs  rolling window size in seconds
     * @throws RuntimeException if the caller has exceeded the limit
     */
    public void check(String key, int maxRequests, int windowSecs) {
        long now = System.currentTimeMillis();
        long windowMs = windowSecs * 1000L;
        boolean[] exceeded = {false};

        requestLog.compute(key, (k, deque) -> {
            if (deque == null) deque = new ArrayDeque<>();

            // Evict timestamps that have fallen outside the window
            while (!deque.isEmpty() && now - deque.peekFirst() > windowMs) {
                deque.pollFirst();
            }

            if (deque.size() >= maxRequests) {
                exceeded[0] = true;
            } else {
                deque.addLast(now);
            }
            return deque;
        });

        if (exceeded[0]) {
            throw new RuntimeException("Too many requests. Please try again later.");
        }
    }
}
