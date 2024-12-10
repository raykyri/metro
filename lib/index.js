/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 *       strict-local
 * @format
 * @oncall react_native
 */

'use strict';

             
                      
                          
                 
                        
                
                       
                 
                 
                   
                    
             
               
         
                 

const Resolver = {
  FailedToResolveNameError: require('./errors/FailedToResolveNameError'),
  FailedToResolvePathError: require('./errors/FailedToResolvePathError'),
  FailedToResolveUnsupportedError: require('./errors/FailedToResolveUnsupportedError'),
  formatFileCandidates: require('./errors/formatFileCandidates'),
  InvalidPackageError: require('./errors/InvalidPackageError'),
  resolve: require('./resolve'),
};

module.exports = Resolver;
