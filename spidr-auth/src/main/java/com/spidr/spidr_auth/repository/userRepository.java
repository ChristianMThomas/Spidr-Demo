package com.spidr.spidr_auth.repository;

import com.spidr.spidr_auth.model.users;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface userRepository extends MongoRepository<users, String> {

    Optional<users> findByEmail(String email);

    Optional<users> findByVerificationCode(String verificationCode);

    boolean existsByEmail(String email);

    boolean existsByUsername(String username);

}
