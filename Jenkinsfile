pipeline {
    agent any

    environment {
        AWS_DEFAULT_REGION = 'ap-south-1'
        CLUSTER_NAME = 'devops-cluster'
        IMAGE_TAG = "${env.BUILD_NUMBER}"
        
        // List of all services to build and deploy
        SERVICES = 'api-gateway,user-service,catalog-service,cart-service,checkout-service,order-service,payment-service,shipping-service,email-service,recommendation-service,ad-service,currency-service,frontend'
    }

    stages {
        stage('Checkout code') {
            steps {
                checkout scm
            }
        }
    stage('Get AWS Account ID') {
        steps {
            withCredentials([[
                $class: 'AmazonWebServicesCredentialsBinding',
                credentialsId: 'aws-jenkins'
        ]]) {
                script {
                    def accountId = sh(
                        script: "aws sts get-caller-identity --query Account --output text",
                        returnStdout: true
                    ).trim()
                    env.ECR_REGISTRY = "${accountId}.dkr.ecr.${AWS_DEFAULT_REGION}.amazonaws.com"
                }
            }
        }
    }
        stage('AWS ECR Login') {
            steps {
                withCredentials([[
                    $class: 'AmazonWebServicesCredentialsBinding',
                    credentialsId: 'aws-jenkins'
                ]]) {
                    script {
                        sh "aws ecr get-login-password --region ${AWS_DEFAULT_REGION} | docker login --username AWS --password-stdin ${ECR_REGISTRY}"
                    }
                }
            }
        }

        stage('Build and Push Images') {
            steps {
                script {
                    def servicesList = SERVICES.split(',')
                    def buildStages = [:]

                    servicesList.each { service ->
                        buildStages["Build ${service}"] = {
                            stage("Docker Build & Push ${service}") {
                                echo "Building ${service}..."
                                sh "docker build -t ${ECR_REGISTRY}/perfume-${service}:${IMAGE_TAG} ./${service}"
                                sh "docker build -t ${ECR_REGISTRY}/perfume-${service}:latest ./${service}"
                                
                                echo "Pushing ${service}..."
                                sh "docker push ${ECR_REGISTRY}/perfume-${service}:${IMAGE_TAG}"
                                sh "docker push ${ECR_REGISTRY}/perfume-${service}:latest"
                            }
                        }
                    }
                    parallel buildStages
                }
            }
        }
        
        stage('Update kubeconfig') {
            steps {
                withCredentials([[
                    $class: 'AmazonWebServicesCredentialsBinding',
                    credentialsId: 'aws-jenkins'
                ]]) {
                    sh '''
                    aws eks update-kubeconfig --region ap-south-1 --name devops-cluster
                    '''
                }
            }
        }
        stage('Clean Helm values files') {
            steps {
                script {
                    sh '''
                    find ./helm -name "values.yaml" | while read f; do
                        echo "Cleaning $f"
                        cat "$f" | tr -cd '\\11\\12\\15\\40-\\176' > "$f.clean"
                        mv "$f.clean" "$f"
                        chown jenkins:jenkins "$f"
                        chmod 644 "$f"
                    done
                    '''
                }
            }
        }
        stage('Deploy with Helm') {
            steps {
                withCredentials([[
                    $class: 'AmazonWebServicesCredentialsBinding',
                    credentialsId: 'aws-jenkins'
                ]]) {
                    script {

                        echo "Deploying PostgreSQL Database..."
                        sh "helm upgrade --install db ./helm/db --namespace perfume --create-namespace --wait"

                        def servicesList = SERVICES.split(',')

                        servicesList.each { service ->
                            echo "Deploying ${service}..."
                            sh """
                            helm upgrade --install ${service} ./helm/${service} \
                            --namespace perfume \
                            --set image.repository=${ECR_REGISTRY}/perfume-${service} \
                            --set image.tag=${IMAGE_TAG} \
                            --set ingress.enabled=true \
                            --wait
                            """
                        }             
                    }
                }
            }
        }
    }

    post {
        success {
            echo 'Deployment successful!'
        }
        failure {
            echo 'Deployment failed. Please check logs.'
        }
    }
}
