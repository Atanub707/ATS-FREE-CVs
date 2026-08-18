FROM pyd4vinci/scrapling:latest
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN python -c "import scrapling, curl_cffi, playwright, lxml, fastapi, uvicorn" && echo "imports ok"
COPY app.py .
EXPOSE 5001
ENTRYPOINT []
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "5001"]